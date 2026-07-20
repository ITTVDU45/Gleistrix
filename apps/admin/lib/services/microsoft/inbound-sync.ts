import { logger } from '@/lib/logger'
import dbConnect from '@/lib/dbConnect'
import PlantafelAssignment from '@/lib/models/PlantafelAssignment'
import { graphGet } from './graph-client'

/**
 * Eingehender Sync: Outlook/Teams → Plantafel.
 *
 * Verarbeitet eine Change-Notification zu einem Kalendertermin:
 * - Termin, der aus der Plantafel stammt (verknüpft über `msCalendar.eventId`):
 *   Zeitänderung wird zurückgespiegelt; Löschung entfernt den Einsatz.
 * - Fremder Outlook-Termin: wird nur dann als (unzugeordneter) Einsatz auf die
 *   Plantafel übernommen, wenn er die Outlook-Kategorie „Plantafel" trägt –
 *   sonst würde jeder Termin des verbundenen Postfachs die Plantafel fluten.
 *
 * Kein Rückschreiben nach Microsoft ⇒ keine Sync-Schleife (die Plantafel→MS-
 * Synchronisation wird nur von den API-Routen ausgelöst, nicht von DB-Writes).
 */

// Muss identisch zur Extended Property in plantafel-sync.ts sein.
const EXT_PROP_ID = 'String {6f2b1a90-1c4d-4e7a-9b2f-3d5e8c1a0f42} Name plantafelAssignmentId'

// Nur Outlook-Termine mit dieser Kategorie werden als Einsatz übernommen.
const IMPORT_CATEGORY = 'Plantafel'

// Sentinel-Projekt für aus Outlook importierte, noch nicht zugeordnete Einsätze.
const OUTLOOK_PROJECT_SENTINEL = '__outlook__'

interface GraphEvent {
  id: string
  subject?: string
  isCancelled?: boolean
  categories?: string[]
  start?: { dateTime: string; timeZone: string }
  end?: { dateTime: string; timeZone: string }
  singleValueExtendedProperties?: Array<{ id: string; value: string }>
}

function parseGraphDate(dt?: { dateTime: string }): Date | null {
  if (!dt?.dateTime) return null
  // Graph liefert lokale Zeit ohne Offset; als UTC interpretieren reicht für die
  // Anzeige (die Plantafel arbeitet mit Date-Objekten, Zeitzone Europe/Berlin).
  const d = new Date(dt.dateTime.endsWith('Z') ? dt.dateTime : `${dt.dateTime}Z`)
  return isNaN(d.getTime()) ? null : d
}

function markerAssignmentId(ev: GraphEvent): string | null {
  const prop = ev.singleValueExtendedProperties?.find((p) => p.id === EXT_PROP_ID)
  return prop?.value || null
}

async function fetchEvent(eventId: string): Promise<GraphEvent | null> {
  const path =
    `/me/events/${eventId}` +
    `?$select=id,subject,isCancelled,categories,start,end` +
    `&$expand=singleValueExtendedProperties($filter=id eq '${encodeURIComponent(EXT_PROP_ID)}')`
  try {
    return await graphGet<GraphEvent>(path)
  } catch {
    return null
  }
}

/**
 * Verarbeitet eine einzelne Benachrichtigung. Best effort.
 */
export async function reconcileEventNotification(
  eventId: string,
  changeType: string
): Promise<void> {
  try {
    await dbConnect()

    // Löschung: verknüpften Einsatz entfernen (idempotent – wenn wir selbst
    // gelöscht haben, existiert kein Assignment mehr).
    if (changeType === 'deleted') {
      await PlantafelAssignment.deleteOne({ 'msCalendar.eventId': eventId })
      return
    }

    const ev = await fetchEvent(eventId)
    if (!ev) return

    // Storniert = wie Löschung behandeln.
    if (ev.isCancelled) {
      await PlantafelAssignment.deleteOne({ 'msCalendar.eventId': eventId })
      return
    }

    const von = parseGraphDate(ev.start)
    const bis = parseGraphDate(ev.end)

    // Bereits verknüpfter Einsatz? → Zeiten/Titel aktualisieren.
    const linked = await PlantafelAssignment.findOne({ 'msCalendar.eventId': eventId })
    if (linked) {
      const update: Record<string, unknown> = { 'msCalendar.lastSyncedAt': new Date() }
      if (von) update.von = von
      if (bis) update.bis = bis
      // Nur bei aus Outlook stammenden Einsätzen den Titel nachziehen.
      if (linked.msCalendar?.source === 'outlook' && ev.subject) update.projektName = ev.subject
      await PlantafelAssignment.updateOne({ _id: linked._id }, update)
      return
    }

    // Von uns erzeugter Termin, dessen DB-Verknüpfung fehlt (Randfall) →
    // Assignment per Marker nachverknüpfen.
    const assignmentId = markerAssignmentId(ev)
    if (assignmentId) {
      const existing = await PlantafelAssignment.findById(assignmentId)
      if (existing) {
        await PlantafelAssignment.updateOne(
          { _id: assignmentId },
          {
            'msCalendar.eventId': ev.id,
            'msCalendar.lastSyncedAt': new Date(),
            ...(von ? { von } : {}),
            ...(bis ? { bis } : {}),
          }
        )
      }
      return
    }

    // Fremder Outlook-Termin: nur mit Kategorie „Plantafel" übernehmen.
    const hasImportCategory = (ev.categories || []).some(
      (c) => c.toLowerCase() === IMPORT_CATEGORY.toLowerCase()
    )
    if (!hasImportCategory || !von || !bis) return

    await PlantafelAssignment.create({
      mitarbeiterId: null,
      mitarbeiterName: '',
      projektId: OUTLOOK_PROJECT_SENTINEL,
      projektName: ev.subject || 'Outlook-Termin',
      von,
      bis,
      notizen: 'Aus Outlook importiert – bitte Projekt/Mitarbeiter zuordnen.',
      bestaetigt: false,
      msCalendar: {
        eventId: ev.id,
        iCalUId: null,
        joinUrl: null,
        lastSyncedAt: new Date(),
        source: 'outlook',
      },
    })
  } catch (err) {
    logger.error('[MS→Plantafel] Reconcile fehlgeschlagen:', err)
  }
}
