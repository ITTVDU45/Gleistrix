import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/dbConnect'
import { requireAuth } from '@/lib/security/requireAuth'
import PlantafelAssignment from '@/lib/models/PlantafelAssignment'
import { Holiday } from '@/lib/models/Holiday'
import { getIslamicHolidaysInRange, holidaysToPlantafelEvents, type PlantafelHoliday } from '@/lib/services/plantafel/holidayService'
import { getPlannedColor, detectEntryShift } from '@/lib/plantafel/projectColors'
import { syncAssignmentToCalendar } from '@/lib/services/microsoft/plantafel-sync'
import mongoose from 'mongoose'

const VACATION_TYPE_KEYWORDS: { keyword: string; type: 'krankheit' | 'sonderurlaub' | 'unbezahlt' }[] = [
  { keyword: 'krank', type: 'krankheit' },
  { keyword: 'sonderurlaub', type: 'sonderurlaub' },
  { keyword: 'unbezahlt', type: 'unbezahlt' },
]

function detectAbsenceType(reason: string): 'urlaub' | 'krankheit' | 'sonderurlaub' | 'unbezahlt' {
  const lower = reason.toLowerCase()
  const match = VACATION_TYPE_KEYWORDS.find((k) => lower.includes(k.keyword))
  return match?.type ?? 'urlaub'
}

const ABSENCE_LABELS: Record<'urlaub' | 'krankheit' | 'sonderurlaub' | 'unbezahlt', string> = {
  urlaub: 'Urlaub',
  krankheit: 'Krankheit',
  sonderurlaub: 'Sonderurlaub',
  unbezahlt: 'Unbezahlt',
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

  const projectQuery: Record<string, unknown> =
    hiddenProjectStatuses.length > 0 ? { status: { $nin: hiddenProjectStatuses } } : {}

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

  const showAbsences = searchParams.get('showAbsences') !== 'false'
  const showGermanHolidays = searchParams.get('showGermanHolidays') !== 'false'
  const showIslamicHolidays = searchParams.get('showIslamicHolidays') === 'true'

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
            const absenceType = detectAbsenceType(reason)
            return {
              id: `urlaub-${id}-${v.id}`,
              title: `${ABSENCE_LABELS[absenceType]}: ${e.name || ''}`,
              start: v.startDate,
              end: v.endDate,
              resourceId: id,
              allDay: true,
              type: absenceType,
              sourceType: 'urlaub',
              sourceId: String(v.id),
              mitarbeiterId: id,
              mitarbeiterName: e.name || '',
              notes: reason,
              hasConflict: false,
            }
          })
      })
    : []

  const holidayRange = { start: new Date(from), end: new Date(to) }
  const holidays: PlantafelHoliday[] = []
  if (showGermanHolidays) {
    const germanHolidays = await Holiday.find({ date: { $gte: from, $lte: to } }).lean()
    holidays.push(...germanHolidays.map((h) => {
      const [y, m, d] = String(h.date).split('-').map(Number)
      return {
        id: `de-${h._id}`,
        name: h.name,
        title: h.bundesland !== 'ALL' ? `${h.name} (regional)` : h.name,
        date: new Date(y, m - 1, d),
        dateKey: String(h.date),
        type: 'german' as const,
        scope: h.bundesland !== 'ALL' ? 'regional' : 'bundesweit',
        states: h.bundesland !== 'ALL' ? [h.bundesland] : undefined,
      }
    }))
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
        const title = auftragsnummer ? `${name} · ${auftragsnummer}` : name
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

  const events = [...einsatzEvents, ...absenceEvents, ...holidayEvents, ...projectEvents]
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
      mitarbeiterName = employee?.name || ''
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
