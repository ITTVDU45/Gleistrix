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
  notizen?: string
  attendees?: Attendee[]
  msCalendar?: { eventId?: string | null } | null
}

interface GraphEventResponse {
  id: string
  iCalUId?: string
  onlineMeeting?: { joinUrl?: string } | null
}

async function isConnectedWithCalendar(): Promise<boolean> {
  await dbConnect()
  const doc = (await IntegrationConfig.findOne({ integrationId: 'microsoft' }).lean()) as Record<string, unknown> | null
  const config = (doc?.config as Record<string, unknown>) || {}
  const modules = (config.enabledModules as string[]) || []
  return doc?.status === 'connected' && modules.includes('calendar')
}

function toGraphDateTime(date: Date): string {
  return new Date(date).toISOString().replace('Z', '')
}

function buildPayload(m: MeetingDoc, timeZone: string): Record<string, unknown> {
  const attendees = (m.attendees || [])
    .filter((a) => a.email)
    .map((a) => ({ emailAddress: { address: a.email, name: a.name || a.email }, type: 'required' }))

  return {
    subject: m.titel || 'Meeting',
    start: { dateTime: toGraphDateTime(m.von), timeZone },
    end: { dateTime: toGraphDateTime(m.bis), timeZone },
    body: { contentType: 'text', content: m.notizen || 'Erstellt aus der Gleistrix-Plantafel.' },
    isOnlineMeeting: true,
    onlineMeetingProvider: 'teamsForBusiness',
    attendees,
    singleValueExtendedProperties: [{ id: EXT_PROP_ID, value: String(m._id) }],
  }
}

async function timeZone(): Promise<string> {
  const doc = (await IntegrationConfig.findOne({ integrationId: 'microsoft' }).lean()) as Record<string, unknown> | null
  const outlook = ((doc?.config as Record<string, unknown>)?.outlook as Record<string, unknown>) || {}
  return (outlook.timeZone as string) || 'Europe/Berlin'
}

/** Legt den Teams-Meeting-Termin an oder aktualisiert ihn. Best effort. */
export async function syncMeetingToCalendar(meetingId: string): Promise<void> {
  try {
    if (!(await isConnectedWithCalendar())) return
    const m = (await PlantafelMeeting.findById(meetingId).lean()) as MeetingDoc | null
    if (!m) return

    const tz = await timeZone()
    const payload = buildPayload(m, tz)
    const existingEventId = m.msCalendar?.eventId || null

    const ev = existingEventId
      ? { ...(await graphPatch<GraphEventResponse>(`/me/events/${existingEventId}`, payload)), id: existingEventId }
      : await graphPost<GraphEventResponse>('/me/events', payload)

    await PlantafelMeeting.findByIdAndUpdate(meetingId, {
      msCalendar: {
        eventId: ev.id,
        iCalUId: ev.iCalUId ?? null,
        joinUrl: ev.onlineMeeting?.joinUrl ?? null,
        lastSyncedAt: new Date(),
        source: 'plantafel',
      },
    })
  } catch (err) {
    console.error('[Meeting→MS] Sync fehlgeschlagen:', err)
  }
}

/** Entfernt den verknüpften Teams-Meeting-Termin. Best effort. */
export async function removeMeetingFromCalendar(
  msCalendar?: { eventId?: string | null } | null
): Promise<void> {
  const eventId = msCalendar?.eventId
  if (!eventId) return
  try {
    if (!(await isConnectedWithCalendar())) return
    await graphDelete(`/me/events/${eventId}`)
  } catch (err) {
    console.error('[Meeting→MS] Entfernen fehlgeschlagen:', err)
  }
}
