import { NextRequest, NextResponse } from 'next/server'
import { getExpectedClientState } from '@/lib/services/microsoft/subscriptions'
import { reconcileEventNotification } from '@/lib/services/microsoft/inbound-sync'

/**
 * Microsoft-Graph Change-Notification-Endpoint (Outlook/Teams → Plantafel).
 *
 * Öffentlich erreichbar (Graph ruft ihn auf) – abgesichert über den geheimen
 * `clientState`, der pro Subscription vergeben wird.
 */

interface Notification {
  subscriptionId?: string
  clientState?: string
  changeType?: string
  resourceData?: { id?: string }
}

export async function POST(req: NextRequest) {
  // 1) Validierungs-Handshake beim Anlegen/Verlängern der Subscription:
  //    Graph sendet ?validationToken=… und erwartet 200 text/plain mit dem Token.
  const validationToken = req.nextUrl.searchParams.get('validationToken')
  if (validationToken) {
    return new NextResponse(validationToken, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    })
  }

  // 2) Reguläre Benachrichtigungen
  let payload: { value?: Notification[] }
  try {
    payload = (await req.json()) as { value?: Notification[] }
  } catch {
    return new NextResponse('Bad Request', { status: 400 })
  }

  const notifications = payload.value || []
  const expectedClientState = await getExpectedClientState()

  for (const n of notifications) {
    // clientState prüfen – schützt vor gefälschten Aufrufen.
    if (expectedClientState && n.clientState !== expectedClientState) continue
    const eventId = n.resourceData?.id
    if (!eventId || !n.changeType) continue
    await reconcileEventNotification(eventId, n.changeType)
  }

  // Graph erwartet eine schnelle 2xx-Antwort.
  return new NextResponse(null, { status: 202 })
}
