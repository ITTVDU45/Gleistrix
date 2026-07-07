import crypto from 'crypto'
import dbConnect from '@/lib/dbConnect'
import IntegrationConfig from '@/lib/models/IntegrationConfig'
import { graphPost, graphPatch, graphDelete } from './graph-client'

/**
 * Microsoft-Graph Change-Notifications (Webhooks) für den eingehenden Sync
 * Outlook/Teams → Plantafel.
 *
 * Wir abonnieren `/me/events` des verbundenen Postfachs. Subscriptions auf
 * Kalendertermine laufen nach ~3 Tagen ab und müssen erneuert werden – das
 * passiert „lazy" beim Laden der Plantafel und beim (Re-)Connect.
 */

// Kalender-Subscriptions: Graph erlaubt max. ~4230 Min. Wir setzen 48h und
// erneuern, sobald weniger als 12h Restlaufzeit bleiben.
const SUBSCRIPTION_MINUTES = 2880
const RENEW_BUFFER_MS = 12 * 60 * 60 * 1000

interface WebhookConfig {
  subscriptionId?: string
  clientState?: string
  expiresAt?: string
  resource?: string
}

interface GraphSubscription {
  id: string
  expirationDateTime: string
  clientState?: string
}

function expirationIso(): string {
  return new Date(Date.now() + SUBSCRIPTION_MINUTES * 60 * 1000).toISOString()
}

/** notificationUrl aus dem Origin der Redirect-URI ableiten (gleiche Domain). */
function deriveNotificationUrl(redirectUri: string): string | null {
  try {
    const origin = new URL(redirectUri).origin
    return `${origin}/api/integrations/microsoft/webhook`
  } catch {
    return null
  }
}

async function getConfig(): Promise<{ status?: string; config: Record<string, unknown> } | null> {
  await dbConnect()
  const doc = (await IntegrationConfig.findOne({ integrationId: 'microsoft' }).lean()) as Record<string, unknown> | null
  if (!doc) return null
  return { status: doc.status as string | undefined, config: (doc.config as Record<string, unknown>) || {} }
}

async function saveWebhookConfig(webhook: WebhookConfig | null): Promise<void> {
  await IntegrationConfig.findOneAndUpdate(
    { integrationId: 'microsoft' },
    { $set: { 'config.webhook': webhook } }
  )
}

/**
 * Stellt sicher, dass eine gültige Events-Subscription existiert: erstellt sie
 * neu oder erneuert sie, wenn sie bald abläuft. Best effort (wirft nicht).
 */
export async function ensureEventsSubscription(): Promise<void> {
  try {
    const doc = await getConfig()
    if (!doc || doc.status !== 'connected') return

    const modules = (doc.config.enabledModules as string[]) || []
    if (!modules.includes('calendar')) return

    const redirectUri = doc.config.redirectUri as string | undefined
    const notificationUrl = redirectUri ? deriveNotificationUrl(redirectUri) : null
    if (!notificationUrl) return

    const webhook = (doc.config.webhook as WebhookConfig) || {}
    const expiresAtMs = webhook.expiresAt ? new Date(webhook.expiresAt).getTime() : 0

    // Noch gültig und ausreichend Restlaufzeit → nichts tun.
    if (webhook.subscriptionId && expiresAtMs > Date.now() + RENEW_BUFFER_MS) return

    // Vorhandene Subscription verlängern …
    if (webhook.subscriptionId) {
      try {
        const renewed = await graphPatch<GraphSubscription>(`/subscriptions/${webhook.subscriptionId}`, {
          expirationDateTime: expirationIso(),
        })
        await saveWebhookConfig({ ...webhook, expiresAt: renewed.expirationDateTime })
        return
      } catch {
        // Verlängerung fehlgeschlagen (abgelaufen/gelöscht) → neu anlegen.
      }
    }

    // … oder neu anlegen.
    const clientState = webhook.clientState || crypto.randomBytes(24).toString('hex')
    const created = await graphPost<GraphSubscription>('/subscriptions', {
      changeType: 'created,updated,deleted',
      notificationUrl,
      resource: '/me/events',
      expirationDateTime: expirationIso(),
      clientState,
    })
    await saveWebhookConfig({
      subscriptionId: created.id,
      clientState,
      expiresAt: created.expirationDateTime,
      resource: '/me/events',
    })
  } catch (err) {
    console.error('[MS Subscription] ensure fehlgeschlagen:', err)
  }
}

/** Löscht die aktive Subscription (beim Trennen der Verbindung). Best effort. */
export async function deleteEventsSubscription(): Promise<void> {
  try {
    const doc = await getConfig()
    const webhook = (doc?.config.webhook as WebhookConfig) || {}
    if (webhook.subscriptionId) {
      try {
        await graphDelete(`/subscriptions/${webhook.subscriptionId}`)
      } catch {
        /* evtl. schon abgelaufen */
      }
    }
    await saveWebhookConfig(null)
  } catch (err) {
    console.error('[MS Subscription] delete fehlgeschlagen:', err)
  }
}

/** Prüft den erwarteten clientState einer eingehenden Benachrichtigung. */
export async function getExpectedClientState(): Promise<string | null> {
  const doc = await getConfig()
  const webhook = (doc?.config.webhook as WebhookConfig) || {}
  return webhook.clientState || null
}
