import dbConnect from '@/lib/dbConnect'
import mongoose from 'mongoose'
import IntegrationConfig from '@/lib/models/IntegrationConfig'
import PlantafelAssignment from '@/lib/models/PlantafelAssignment'
import { graphPost, graphPatch, graphDelete } from './graph-client'

/**
 * Plantafel → Outlook/Teams Synchronisation.
 *
 * Ein Plantafel-Einsatz wird als Kalendertermin im verbundenen Firmenpostfach
 * angelegt (`isOnlineMeeting` ⇒ Teams-Meeting-Link), die zugeordneten
 * Mitarbeiter werden als Teilnehmer eingeladen. Die erzeugte Event-ID wird am
 * Assignment gespeichert, damit Änderungen/Löschungen den richtigen Termin
 * treffen und (Phase 2) eingehende Webhooks Duplikate/Schleifen vermeiden.
 *
 * Alle Funktionen sind „best effort": Sie werfen nicht in den Aufrufer zurück,
 * damit das Speichern eines Einsatzes nie an einem Microsoft-Fehler scheitert.
 */

// Fester GUID-Namensraum für die Extended Property, über die wir „unsere"
// Termine wiedererkennen (Phase 2). Wert = Assignment-ID.
const EXT_PROP_ID = 'String {6f2b1a90-1c4d-4e7a-9b2f-3d5e8c1a0f42} Name plantafelAssignmentId'

interface SyncSettings {
  connected: boolean
  calendarEnabled: boolean
  syncOnlyConfirmed: boolean
  timeZone: string
}

interface GraphEventResponse {
  id: string
  iCalUId?: string
  onlineMeeting?: { joinUrl?: string } | null
}

interface AssignmentDoc {
  _id: unknown
  mitarbeiterId?: string | null
  projektName?: string
  von: Date
  bis: Date
  rolle?: string
  notizen?: string
  bestaetigt?: boolean
  msCalendar?: {
    eventId?: string | null
    iCalUId?: string | null
    joinUrl?: string | null
    source?: string
  } | null
}

async function loadSettings(): Promise<SyncSettings> {
  await dbConnect()
  const doc = (await IntegrationConfig.findOne({ integrationId: 'microsoft' }).lean()) as Record<string, unknown> | null
  const config = (doc?.config as Record<string, unknown>) || {}
  const modules = (config.enabledModules as string[]) || []
  const outlook = (config.outlook as Record<string, unknown>) || {}
  return {
    connected: doc?.status === 'connected',
    calendarEnabled: modules.includes('calendar'),
    syncOnlyConfirmed: outlook.syncOnlyConfirmed !== false,
    timeZone: (outlook.timeZone as string) || 'Europe/Berlin',
  }
}

/** Graph erwartet lokale Zeit ohne Zeitzonen-Offset (Zeitzone im timeZone-Feld). */
function toGraphDateTime(date: Date): string {
  return new Date(date).toISOString().replace('Z', '')
}

async function resolveAttendee(mitarbeiterId?: string | null): Promise<{ address: string; name: string } | null> {
  if (!mitarbeiterId) return null
  const db = mongoose.connection.db
  if (!db) return null
  try {
    const emp = await db.collection('employees').findOne({ _id: new mongoose.Types.ObjectId(mitarbeiterId) })
    const address = (emp?.email as string) || ''
    if (!address) return null
    return { address, name: (emp?.name as string) || address }
  } catch {
    return null
  }
}

function buildEventPayload(
  a: AssignmentDoc,
  attendee: { address: string; name: string } | null
): Record<string, unknown> {
  const subjectParts = [a.projektName || 'Einsatz', a.rolle].filter(Boolean)
  const bodyLines = [
    a.projektName ? `Projekt: ${a.projektName}` : '',
    a.rolle ? `Funktion: ${a.rolle}` : '',
    a.notizen ? `Notizen: ${a.notizen}` : '',
    'Erstellt aus der Gleistrix-Plantafel.',
  ].filter(Boolean)

  // Gespeicherte Zeit ist echtes UTC → als UTC senden (kein 2h-Versatz).
  return {
    subject: subjectParts.join(' – '),
    start: { dateTime: toGraphDateTime(a.von), timeZone: 'UTC' },
    end: { dateTime: toGraphDateTime(a.bis), timeZone: 'UTC' },
    body: { contentType: 'text', content: bodyLines.join('\n') },
    isOnlineMeeting: true,
    onlineMeetingProvider: 'teamsForBusiness',
    attendees: attendee
      ? [{ emailAddress: { address: attendee.address, name: attendee.name }, type: 'required' }]
      : [],
    singleValueExtendedProperties: [{ id: EXT_PROP_ID, value: String(a._id) }],
  }
}

async function persistMsCalendar(assignmentId: string, ev: GraphEventResponse): Promise<void> {
  await PlantafelAssignment.findByIdAndUpdate(assignmentId, {
    msCalendar: {
      eventId: ev.id,
      iCalUId: ev.iCalUId ?? null,
      joinUrl: ev.onlineMeeting?.joinUrl ?? null,
      lastSyncedAt: new Date(),
      source: 'plantafel',
    },
  })
}

/**
 * Legt den Kalendertermin an oder aktualisiert ihn; entfernt ihn, wenn der
 * Einsatz nicht (mehr) synchronisiert werden soll (z.B. unbestätigt bei
 * „nur bestätigte Einsätze"). Best effort.
 */
export async function syncAssignmentToCalendar(assignmentId: string): Promise<void> {
  try {
    const settings = await loadSettings()
    if (!settings.connected || !settings.calendarEnabled) return

    const a = (await PlantafelAssignment.findById(assignmentId).lean()) as AssignmentDoc | null
    if (!a) return

    const existingEventId = a.msCalendar?.eventId || null

    // „Nur bestätigte Einsätze": unbestätigte nicht anlegen; vorhandenen Termin entfernen.
    if (settings.syncOnlyConfirmed && !a.bestaetigt) {
      if (existingEventId) {
        await removeCalendarEvent(existingEventId)
        await PlantafelAssignment.findByIdAndUpdate(assignmentId, { msCalendar: null })
      }
      return
    }

    const attendee = await resolveAttendee(a.mitarbeiterId)
    const payload = buildEventPayload(a, attendee)

    if (existingEventId) {
      const ev = await graphPatch<GraphEventResponse>(`/me/events/${existingEventId}`, payload)
      await persistMsCalendar(assignmentId, { ...ev, id: existingEventId })
    } else {
      const ev = await graphPost<GraphEventResponse>('/me/events', payload)
      await persistMsCalendar(assignmentId, ev)
    }
  } catch (err) {
    console.error('[Plantafel→MS] Kalender-Sync fehlgeschlagen:', err)
  }
}

async function removeCalendarEvent(eventId: string): Promise<void> {
  try {
    await graphDelete(`/me/events/${eventId}`)
  } catch (err) {
    // Bereits gelöscht (404) o.ä. – nur protokollieren.
    console.error('[Plantafel→MS] Kalendertermin löschen fehlgeschlagen:', err)
  }
}

/** Entfernt den verknüpften Kalendertermin beim Löschen eines Einsatzes. Best effort. */
export async function removeAssignmentFromCalendar(
  msCalendar?: { eventId?: string | null } | null
): Promise<void> {
  const eventId = msCalendar?.eventId
  if (!eventId) return
  try {
    const settings = await loadSettings()
    if (!settings.connected) return
    await removeCalendarEvent(eventId)
  } catch (err) {
    console.error('[Plantafel→MS] Kalender-Entfernung fehlgeschlagen:', err)
  }
}
