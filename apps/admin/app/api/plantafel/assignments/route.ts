import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/dbConnect'
import { requireAuth } from '@/lib/security/requireAuth'
import PlantafelAssignment from '@/lib/models/PlantafelAssignment'
import PlantafelMeeting from '@/lib/models/PlantafelMeeting'
import { Holiday } from '@/lib/models/Holiday'
import {
  getCustomHolidaysForPlantafel,
  getGermanHolidaysForPlantafel,
  getIslamicHolidaysInRange,
  holidaysToPlantafelEvents,
  type PlantafelHoliday,
} from '@/lib/services/plantafel/holidayService'
import { normalizeStateCodes } from '@/lib/holidays'
import { getPlannedColor, detectEntryShift } from '@/lib/plantafel/projectColors'
import { formatProjectBarTitle } from '@/lib/plantafel/projectLabel'
import {
  findEmployeeAbsenceDuringPeriod,
  formatEmployeeAbsenceConflict,
  getEmployeeAbsenceMeta,
  getEmployeeAbsenceType,
} from '@/lib/employeeAbsence'
import type { VacationDay } from '@/types/main'
import { syncAssignmentToCalendar } from '@/lib/services/microsoft/plantafel-sync'
import { ensureEventsSubscription } from '@/lib/services/microsoft/subscriptions'
import mongoose from 'mongoose'

function toPlantafelAbsenceType(absence: Pick<VacationDay, 'type' | 'reason'>) {
  switch (getEmployeeAbsenceType(absence)) {
    case 'arbeitsunfaehigkeit': return 'krankheit' as const
    case 'unbezahlte_freistellung': return 'unbezahlt' as const
    case 'fortbildung': return 'fortbildung' as const
    default: return 'urlaub' as const
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  }

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  if (!from || !to) {
    return NextResponse.json({ success: false, error: 'from und to sind erforderlich' }, { status: 400 })
  }

  await dbConnect()

  // Webhook-Subscription lazy erneuern (nur wenn nötig; best effort, intern geschützt)
  await ensureEventsSubscription()

  const query: Record<string, unknown> = {
    von: { $lte: new Date(to) },
    bis: { $gte: new Date(from) },
  }

  const employeeIds = searchParams.get('employeeIds')
  if (employeeIds) {
    query.mitarbeiterId = { $in: employeeIds.split(',') }
  }

  const projectIds = searchParams.get('projectIds')
  if (projectIds) {
    query.projektId = { $in: projectIds.split(',') }
  }

  const assignments = await PlantafelAssignment.find(query).lean()

  const einsatzEvents = assignments.map((a: Record<string, unknown>) => ({
    id: String(a._id),
    title: (a.projektName as string) || 'Kein Projekt',
    start: a.von,
    end: a.bis,
    resourceId: (a.mitarbeiterId as string) || '__unassigned__',
    type: 'einsatz',
    sourceType: 'einsatz',
    sourceId: String(a._id),
    mitarbeiterId: a.mitarbeiterId,
    mitarbeiterName: a.mitarbeiterName,
    projektId: a.projektId,
    projektName: a.projektName,
    notes: a.notizen,
    bestaetigt: a.bestaetigt,
    rolle: a.rolle,
    setupDate: a.setupDate,
    dismantleDate: a.dismantleDate,
    einsatzLinkId: a.einsatzLinkId ?? undefined,
    msJoinUrl: (a.msCalendar as { joinUrl?: string } | null)?.joinUrl ?? undefined,
    hasConflict: false,
  }))

  // Ressourcen laden
  const db = mongoose.connection.db
  if (!db) {
    return NextResponse.json({ success: false, error: 'DB nicht verbunden' }, { status: 500 })
  }

  const showProjects = searchParams.get('showProjects') !== 'false'
  const hiddenProjectStatuses = (searchParams.get('hiddenProjectStatuses') || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  // Projekte ohne gesetzten Status gelten überall als 'kein Status' — beim
  // Ausblenden dieses Status müssen daher auch fehlende und leere Werte raus.
  const hiddenStatusValues: (string | null)[] = hiddenProjectStatuses.includes('kein Status')
    ? [...hiddenProjectStatuses, '', null]
    : hiddenProjectStatuses

  const projectQuery: Record<string, unknown> =
    hiddenProjectStatuses.length > 0 ? { status: { $nin: hiddenStatusValues } } : {}

  const [employees, projects] = await Promise.all([
    db.collection('employees').find({ status: { $ne: 'nicht aktiv' } }).toArray(),
    db
      .collection('projects')
      .find(projectQuery, {
        projection: {
          name: 1,
          status: 1,
          auftraggeber: 1,
          auftragsnummer: 1,
          baustelle: 1,
          datumBeginn: 1,
          datumEnde: 1,
          mitarbeiterZeiten: 1,
        },
      })
      .toArray(),
  ])

  const view = searchParams.get('view') || 'team'

  // Meetings (projektunabhängig) – je Mitarbeiter-Teilnehmer eine Zeile; nur Team-Ansicht
  const meetingEvents: Record<string, unknown>[] = []
  if (view === 'team') {
    const meetings = await PlantafelMeeting.find({
      von: { $lte: new Date(to) },
      bis: { $gte: new Date(from) },
    }).lean()

    for (const m of meetings as Record<string, unknown>[]) {
      const attendees = (Array.isArray(m.attendees) ? m.attendees : []) as Array<{ employeeId?: string | null; name?: string; email?: string }>
      const joinUrl = (m.msCalendar as { joinUrl?: string } | null)?.joinUrl ?? undefined
      const ort = m.modus === 'vorOrt' ? ((m.ort as string) || '') : ''
      const employeeAttendees = attendees.filter((a) => a.employeeId)
      const externals = attendees.filter((a) => !a.employeeId).map((a) => a.name || a.email).filter(Boolean)
      const summary = [
        employeeAttendees.map((a) => a.name).filter(Boolean).join(', '),
        externals.length ? `extern: ${externals.join(', ')}` : '',
      ].filter(Boolean).join(' · ')
      const lanes = employeeAttendees.length > 0
        ? employeeAttendees.map((a) => String(a.employeeId))
        : ['__unassigned__']

      for (const laneId of lanes) {
        meetingEvents.push({
          id: `meeting-${String(m._id)}-${laneId}`,
          title: (m.titel as string) || 'Meeting',
          start: m.von,
          end: m.bis,
          resourceId: laneId,
          type: 'meeting',
          sourceType: 'meeting',
          sourceId: String(m._id),
          notes: [(m.notizen as string) || '', summary].filter(Boolean).join(' — '),
          msJoinUrl: joinUrl,
          ort: ort || undefined,
          hasConflict: false,
        })
      }
    }
  }

  const showAbsences = searchParams.get('showAbsences') !== 'false'
  const showGermanHolidays = searchParams.get('showGermanHolidays') !== 'false'
  const showIslamicHolidays = searchParams.get('showIslamicHolidays') === 'true'
  const showPartialHolidays = searchParams.get('showPartialHolidays') !== 'false'
  // Leere Auswahl = alle Bundesländer; unbekannte Kürzel werden verworfen.
  const holidayStates = normalizeStateCodes((searchParams.get('holidayStates') || '').split(','))

  const employeeIdFilter = employeeIds ? new Set(employeeIds.split(',')) : null

  const absenceEvents = showAbsences && view === 'team'
    ? employees.flatMap((e) => {
        const id = String(e._id)
        if (employeeIdFilter && !employeeIdFilter.has(id)) return []
        const vacationDays = Array.isArray(e.vacationDays) ? e.vacationDays : []
        return vacationDays
          .filter((v: Record<string, unknown>) => v.approved !== false)
          .filter((v: Record<string, unknown>) => new Date(v.startDate as string) <= new Date(to) && new Date(v.endDate as string) >= new Date(from))
          .map((v: Record<string, unknown>) => {
            const reason = (v.reason as string) || ''
            const absence = { type: v.type, reason } as Pick<VacationDay, 'type' | 'reason'>
            const absenceType = toPlantafelAbsenceType(absence)
            const absenceMeta = getEmployeeAbsenceMeta(absence)
            return {
              id: `abwesenheit-${id}-${v.id}`,
              title: `${absenceMeta.label}: ${e.name || ''}`,
              start: v.startDate,
              end: v.endDate,
              resourceId: id,
              allDay: true,
              type: absenceType,
              sourceType: 'urlaub',
              sourceId: String(v.id),
              mitarbeiterId: id,
              mitarbeiterName: e.name || '',
              urlaubTyp: absenceType,
              notes: reason,
              hasConflict: false,
            }
          })
      })
    : []

  const holidayRange = { start: new Date(from), end: new Date(to) }
  const holidays: PlantafelHoliday[] = []
  if (showGermanHolidays) {
    // Gesetzliche Feiertage werden berechnet (bundesweit + regional, alle 16
    // Länder); die DB liefert nur noch betriebliche Zusatztage.
    const germanHolidays = getGermanHolidaysForPlantafel(from, to, holidayStates, showPartialHolidays)
    const customRecords = await Holiday.find({ date: { $gte: from, $lte: to } }).lean()
    holidays.push(
      ...germanHolidays,
      ...getCustomHolidaysForPlantafel(customRecords, germanHolidays, holidayStates)
    )
  }
  if (showIslamicHolidays) {
    holidays.push(...getIslamicHolidaysInRange(holidayRange))
  }
  const holidayEvents = holidaysToPlantafelEvents(holidays)

  // Projekt-Events: Laufzeit-Balken (geplant, Statusfarbe) + Tage mit erfassten
  // Zeiten (umgesetzt, Schichtfarbe: Früh-/Tagschicht grün, Nachtschicht rot)
  const todayKey = new Date().toISOString().slice(0, 10)
  const projectEvents = showProjects
    ? projects.flatMap((p) => {
        const id = String(p._id)
        const name = (p.name as string) || 'Projekt'
        const auftragsnummer = (p.auftragsnummer as string) || ''
        const title = formatProjectBarTitle(name, auftragsnummer)
        const status = (p.status as string) || ''
        const evts: Record<string, unknown>[] = []

        const beginn = p.datumBeginn ? String(p.datumBeginn).slice(0, 10) : ''
        const ende = p.datumEnde ? String(p.datumEnde).slice(0, 10) : ''

        if (beginn && ende && beginn <= to && ende >= from) {
          // Schicht-Zählung pro Zeiteintrag im Sichtbereich (ein Tag kann Früh- UND
          // Nachtschicht enthalten — daher pro Eintrag, nicht pro Tag aggregieren)
          const zeitenMap = (p.mitarbeiterZeiten as Record<string, unknown>) || {}
          let tagCount = 0
          let nachtCount = 0
          let recordedDays = 0
          for (const [dateKey, entries] of Object.entries(zeitenMap)) {
            if (!Array.isArray(entries) || entries.length === 0) continue
            if (dateKey < from || dateKey > to) continue
            recordedDays += 1
            for (const e of entries as Array<{ start?: string; ende?: string }>) {
              if (detectEntryShift(e.start, e.ende) === 'nacht') nachtCount += 1
              else tagCount += 1
            }
          }

          const notStarted = beginn > todayKey
          // Ein Projekt = ein Balken (Statusfarbe / Senf wenn nicht gestartet);
          // Schichten werden als Badges (mit Anzahl) auf dem Balken dargestellt.
          evts.push({
            id: `proj-${id}`,
            title,
            start: p.datumBeginn,
            end: p.datumEnde,
            resourceId: id,
            allDay: true,
            type: 'projekt_plan',
            sourceType: 'projekt',
            sourceId: id,
            projektId: id,
            projektName: name,
            status,
            notStarted,
            color: getPlannedColor(status, notStarted),
            shiftCounts: { tag: tagCount, nacht: nachtCount },
            recordedDays,
            hasConflict: false,
          })
        }

        return evts
      })
    : []

  // Erfasste Zeiten (mitarbeiterZeiten) als Blöcke in Team-Ansicht,
  // dedupliziert gegen Einsätze, die bereits denselben Zeiteintrag abbilden.
  const einsatzLinkIds = new Set(
    (assignments.map((a) => a.einsatzLinkId).filter(Boolean) as string[])
  )
  const employeeIdByName = new Map<string, string>()
  for (const e of employees) {
    if (e.name) employeeIdByName.set(String(e.name), String(e._id))
  }
  const fromDay = from.slice(0, 10)
  const toDay = to.slice(0, 10)

  const zeitEvents: Record<string, unknown>[] = []
  if (view === 'team') {
    for (const p of projects as Record<string, unknown>[]) {
      const projId = String(p._id)
      const projName = (p.name as string) || 'Projekt'
      const zeitenMap = (p.mitarbeiterZeiten as Record<string, unknown>) || {}
      for (const [dateKey, entries] of Object.entries(zeitenMap)) {
        if (dateKey < fromDay || dateKey > toDay || !Array.isArray(entries)) continue
        entries.forEach((raw, idx) => {
          const e = raw as Record<string, unknown>
          const linkId = e.einsatzLinkId as string | undefined
          if (linkId && einsatzLinkIds.has(linkId)) return // bereits als Einsatz sichtbar
          const start = e.start as string
          const ende = e.ende as string
          if (!start || !ende) return
          const isExternal = Boolean(e.isExternal)
          const name = (e.name as string) || ''
          const empId = !isExternal ? employeeIdByName.get(name) : undefined
          zeitEvents.push({
            id: `zeit-${projId}-${dateKey}-${idx}`,
            title: projName,
            start,
            end: ende,
            resourceId: empId || '__unassigned__',
            type: 'zeit',
            sourceType: 'zeit',
            sourceId: projId,
            mitarbeiterId: empId,
            mitarbeiterName: name,
            projektId: projId,
            projektName: projName,
            rolle: (e.funktion as string) || (e.externalFunctionSummary as string) || '',
            notes: (e.bemerkung as string) || '',
            hasConflict: false,
          })
        })
      }
    }
  }

  const events = [...einsatzEvents, ...zeitEvents, ...meetingEvents, ...absenceEvents, ...holidayEvents, ...projectEvents]
  const resources = view === 'team'
    ? employees.map((e) => ({
        resourceId: String(e._id),
        resourceTitle: e.name || '',
        type: 'employee' as const,
        aktiv: e.status === 'aktiv',
      }))
    : projects.map((p) => ({
        resourceId: String(p._id),
        resourceTitle: p.name || '',
        type: 'project' as const,
        projektname: p.name,
        auftraggeber: p.auftraggeber,
        status: p.status,
        baustelle: p.baustelle,
      }))

  return NextResponse.json({
    success: true,
    data: {
      events,
      resources,
      conflicts: [],
      meta: { from, to, totalEvents: events.length, totalConflicts: 0 },
    },
  })
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  }

  await dbConnect()

  const body = await req.json()
  const { mitarbeiterId, projektId, von, bis, rolle, notizen, bestaetigt, setupDate, dismantleDate, einsatzLinkId } = body

  if (!projektId || !von || !bis) {
    return NextResponse.json({ success: false, error: 'projektId, von und bis sind erforderlich' }, { status: 400 })
  }

  // Projekt- und Mitarbeiternamen auflösen
  const db = mongoose.connection.db
  if (!db) {
    return NextResponse.json({ success: false, error: 'DB nicht verbunden' }, { status: 500 })
  }

  let projektName = ''
  let mitarbeiterName = ''

  try {
    const project = await db.collection('projects').findOne({ _id: new mongoose.Types.ObjectId(projektId) })
    projektName = project?.name || ''
  } catch { /* ignore */ }

  if (mitarbeiterId) {
    try {
      const employee = await db.collection('employees').findOne({ _id: new mongoose.Types.ObjectId(mitarbeiterId) })
      if (employee) {
        mitarbeiterName = employee.name || ''
        const absence = findEmployeeAbsenceDuringPeriod(
          employee.vacationDays as VacationDay[] | undefined,
          new Date(von),
          new Date(bis)
        )
        if (absence) {
          return NextResponse.json(
            { success: false, error: formatEmployeeAbsenceConflict(mitarbeiterName || 'Mitarbeiter', absence) },
            { status: 409 }
          )
        }
      }
    } catch { /* ignore */ }
  }

  const assignment = await PlantafelAssignment.create({
    mitarbeiterId: mitarbeiterId || null,
    mitarbeiterName,
    projektId,
    projektName,
    von: new Date(von),
    bis: new Date(bis),
    rolle: rolle || '',
    notizen: notizen || '',
    bestaetigt: bestaetigt || false,
    setupDate: setupDate || null,
    dismantleDate: dismantleDate || null,
    einsatzLinkId: einsatzLinkId || null,
  })

  // Best-effort: Outlook-/Teams-Termin im verbundenen Postfach erzeugen
  await syncAssignmentToCalendar(String(assignment._id))

  return NextResponse.json({ success: true, data: { id: String(assignment._id) } }, { status: 201 })
}
