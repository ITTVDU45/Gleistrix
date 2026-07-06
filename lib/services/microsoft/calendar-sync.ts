import { graphGet, graphPost, graphPatch, graphDelete } from './graph-client'

interface GraphEvent {
  id?: string
  subject: string
  start: { dateTime: string; timeZone: string }
  end: { dateTime: string; timeZone: string }
  body?: { contentType: string; content: string }
  location?: { displayName: string }
  isAllDay?: boolean
}

interface GraphEventListResponse {
  value: GraphEvent[]
  '@odata.nextLink'?: string
}

export interface CalendarEventInput {
  subject: string
  startDateTime: string
  endDateTime: string
  timeZone: string
  body?: string
  location?: string
  isAllDay?: boolean
}

export async function listCalendarEvents(
  startDate: string,
  endDate: string,
  timeZone = 'Europe/Berlin'
): Promise<GraphEvent[]> {
  const params = new URLSearchParams({
    startDateTime: startDate,
    endDateTime: endDate,
    $orderby: 'start/dateTime',
    $top: '100',
  })

  const result = await graphGet<GraphEventListResponse>(
    `/me/calendarView?${params.toString()}`
  )

  return result.value || []
}

export async function createCalendarEvent(input: CalendarEventInput): Promise<GraphEvent> {
  const event: GraphEvent = {
    subject: input.subject,
    start: { dateTime: input.startDateTime, timeZone: input.timeZone },
    end: { dateTime: input.endDateTime, timeZone: input.timeZone },
    isAllDay: input.isAllDay,
  }

  if (input.body) {
    event.body = { contentType: 'text', content: input.body }
  }

  if (input.location) {
    event.location = { displayName: input.location }
  }

  return graphPost<GraphEvent>('/me/events', event)
}

export async function updateCalendarEvent(
  eventId: string,
  input: Partial<CalendarEventInput>
): Promise<GraphEvent> {
  const update: Partial<GraphEvent> = {}

  if (input.subject) update.subject = input.subject
  if (input.startDateTime && input.timeZone) {
    update.start = { dateTime: input.startDateTime, timeZone: input.timeZone }
  }
  if (input.endDateTime && input.timeZone) {
    update.end = { dateTime: input.endDateTime, timeZone: input.timeZone }
  }
  if (input.body) update.body = { contentType: 'text', content: input.body }
  if (input.location) update.location = { displayName: input.location }

  return graphPatch<GraphEvent>(`/me/events/${eventId}`, update)
}

export async function deleteCalendarEvent(eventId: string): Promise<void> {
  await graphDelete(`/me/events/${eventId}`)
}
