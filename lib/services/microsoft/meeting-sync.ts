import dbConnect from '@/lib/dbConnect'
import IntegrationConfig from '@/lib/models/IntegrationConfig'
import PlantafelMeeting from '@/lib/models/PlantafelMeeting'
import { graphPost, graphPatch, graphDelete } from './graph-client'

/**
 * Plantafel-Meeting → Outlook/Teams.
 *
 * Legt für ein projektunabhängiges Meeting ein Teams-Online-Meeting im
 * verbundenen Postfach an (mit allen Teilnehmern – Mitarbeitern und externen
 * E-Mails) und speichert Event-ID + Join-Link am Meeting. Best effort.
 */

const EXT_PROP_ID = 'String {6f2b1a90-1c4d-4e7a-9b2f-3d5e8c1a0f42} Name plantafelMeetingId'

interface Attendee {
  employeeId?: string | null
  name?: string
  email: string
}

interface MeetingDoc {
  _id: unknown
  titel: string
  von: Date
  bis: Date
  modus?: 'teams' | 'vorOrt'
  ort?: string
  notizen?: string
  attendees?: Attendee[]
  msCalendar?: { eventId?: string | null } | null
}

interface GraphEventResponse {
  id: string
  iCalUId?: string
  onlineMeeting?: { joinUrl?: string } | null
}

export interface MeetingSyncResult {
  /** Teams-Meeting im Postfach erstellt/aktualisiert (Einladungen versendet). */
  created: boolean
  joinUrl?: string | null
  eventId?: string | null
  /** Grund, falls nicht erstellt: 'not_connected' | 'no_calendar_module' | Fehlertext. */
  reason?: string
}

async function connectionState(): Promise<{ connected: boolean; calendar: boolean }> {
  await dbConnect()
  const doc = (await IntegrationConfig.findOne({ integrationId: 'microsoft' }).lean()) as Record<string, unknown> | null
  const config = (doc?.config as Record<string, unknown>) || {}
  const modules = (config.enabledModules as string[]) || []
  return { connected: doc?.status === 'connected', calendar: modules.includes('calendar') }
}

function toGraphDateTime(date: Date): string {
  return new Date(date).toISOString().replace('Z', '')
}

function buildPayload(m: MeetingDoc): Record<string, unknown> {
  const attendees = (m.attendees || [])
    .filter((a) => a.email)
    .map((a) => ({ emailAddress: { address: a.email, name: a.name || a.email }, type: 'required' }))

  const vorOrt = m.modus === 'vorOrt'

  // Die gespeicherte Zeit ist echtes UTC – daher als UTC an Graph senden
  // (nicht die UTC-Uhrzeit fälschlich als lokale Zeitzone labeln → 2h-Versatz).
  const payload: Record<string, unknown> = {
    subject: m.titel || 'Meeting',
    start: { dateTime: toGraphDateTime(m.von), timeZone: 'UTC' },
    end: { dateTime: toGraphDateTime(m.bis), timeZone: 'UTC' },
    body: { contentType: 'text', content: m.notizen || 'Erstellt aus der Gleistrix-Plantafel.' },
    attendees,
    singleValueExtendedProperties: [{ id: EXT_PROP_ID, value: String(m._id) }],
  }

  if (vorOrt) {
    // Präsenztermin mit Adresse, kein Teams-Link
    payload.isOnlineMeeting = false
    if (m.ort) payload.location = { displayName: m.ort }
  } else {
    // Online-Besprechung mit Teams-Join-Link
    payload.isOnlineMeeting = true
    payload.onlineMeetingProvider = 'teamsForBusiness'
  }

  return payload
}

/**
 * Legt den Teams-Meeting-Termin an oder aktualisiert ihn und versendet dabei die
 * Einladungen an alle Teilnehmer. Liefert das Ergebnis zurück (für UI-Feedback).
 */
export async function syncMeetingToCalendar(meetingId: string): Promise<MeetingSyncResult> {
  const state = await connectionState()
  if (!state.connected) return { created: false, reason: 'not_connected' }
  if (!state.calendar) return { created: false, reason: 'no_calendar_module' }

  const m = (await PlantafelMeeting.findById(meetingId).lean()) as MeetingDoc | null
  if (!m) return { created: false, reason: 'Meeting nicht gefunden' }

  try {
    const payload = buildPayload(m)
    const existingEventId = m.msCalendar?.eventId || null

    // POST /me/events mit Teilnehmern versendet die Einladungen automatisch.
    const ev = existingEventId
      ? { ...(await graphPatch<GraphEventResponse>(`/me/events/${existingEventId}`, payload)), id: existingEventId }
      : await graphPost<GraphEventResponse>('/me/events', payload)

    const joinUrl = ev.onlineMeeting?.joinUrl ?? null
    await PlantafelMeeting.findByIdAndUpdate(meetingId, {
      msCalendar: {
        eventId: ev.id,
        iCalUId: ev.iCalUId ?? null,
        joinUrl,
        lastSyncedAt: new Date(),
        source: 'plantafel',
      },
    })
    return { created: true, joinUrl, eventId: ev.id }
  } catch (err) {
    console.error('[Meeting→MS] Sync fehlgeschlagen:', err)
    return { created: false, reason: err instanceof Error ? err.message : 'Unbekannter Fehler' }
  }
}

/** Entfernt den verknüpften Teams-Meeting-Termin. Best effort. */
export async function removeMeetingFromCalendar(
  msCalendar?: { eventId?: string | null } | null
): Promise<void> {
  const eventId = msCalendar?.eventId
  if (!eventId) return
  try {
    const state = await connectionState()
    if (!state.connected) return
    await graphDelete(`/me/events/${eventId}`)
  } catch (err) {
    console.error('[Meeting→MS] Entfernen fehlgeschlagen:', err)
  }
}
