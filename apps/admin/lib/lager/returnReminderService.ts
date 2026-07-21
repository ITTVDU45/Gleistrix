import dbConnect from '@/lib/dbConnect'
import { logger } from '@/lib/logger'
import { sendEmailResult, getEmailBranding } from '@/lib/mailer'
import { ArticleAssignment } from '@/lib/models/ArticleAssignment'
import { StockMovement } from '@/lib/models/StockMovement'
import NotificationLog from '@/lib/models/NotificationLog'
import NotificationSettings from '@/lib/models/NotificationSettings'
import ReturnReminderNotification from '@/lib/models/ReturnReminderNotification'
import User from '@/lib/models/User'
import '@/lib/models/Article'
import '@/lib/models/DeliveryNote'
import '@/lib/models/Employee'
import {
  DEFAULT_RETURN_REMINDER_CONFIG,
  RETURN_REMINDER_NOTIFICATION_KEY,
  type ReturnReminderInterval,
} from '@/lib/notificationDefs'
import {
  calendarDateKeyInTimeZone,
  isReturnReminderDue,
  maxReminderHorizonDays,
  normalizeReturnReminderConfig,
  returnReminderIntervalLabel,
  returnReminderMessage,
} from './returnReminderSchedule'

const DEFAULT_TIME_ZONE = 'Europe/Berlin'
const RETRY_DELAY_MS = 12 * 60 * 60 * 1000
const STALE_PROCESSING_MS = 15 * 60 * 1000

type PopulatedUser = { _id?: unknown; id?: unknown; email?: string; name?: string }
type PopulatedArticle = { _id?: unknown; id?: unknown; bezeichnung?: string; artikelnummer?: string }
type PopulatedEmployee = { _id?: unknown; id?: unknown; name?: string }
type ReminderNotificationRecord = {
  _id: unknown
  assignmentId: unknown
  recipientEmail: string
  recipientName?: string
  articleName?: string
  employeeName?: string
  dueDate: Date | string
  interval?: { value?: unknown; unit?: unknown; label?: string }
}

type AssignmentCandidate = {
  _id: unknown
  artikelId: PopulatedArticle | unknown
  personId: PopulatedEmployee | unknown
  lieferscheinId?: { verantwortlich?: PopulatedUser | unknown } | unknown
  ausgabedatum: Date
  geplanteRueckgabe: Date
  ausgegebenVon?: { userId?: string; name?: string; email?: string }
}

export interface ReturnReminderRunResult {
  enabled: boolean
  candidates: number
  created: number
  emailsSent: number
  emailsFailed: number
  skippedWithoutIssuer: number
}

function objectIdString(value: unknown): string {
  if (!value) return ''
  if (typeof value === 'object') {
    const record = value as { _id?: unknown; id?: unknown }
    const nested = record._id ?? record.id
    return nested == null ? '' : String(nested)
  }
  return String(value)
}

function asUser(value: unknown): PopulatedUser | null {
  if (!value || typeof value !== 'object') return null
  return value as PopulatedUser
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function appBaseUrl(): string {
  return String(process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXTAUTH_URL || '').replace(/\/+$/, '')
}

async function resolveIssuer(assignment: AssignmentCandidate): Promise<{
  userId: string
  email: string
  name: string
} | null> {
  const snapshot = assignment.ausgegebenVon
  let userId = String(snapshot?.userId ?? '').trim()
  let email = String(snapshot?.email ?? '').trim().toLowerCase()
  let name = String(snapshot?.name ?? '').trim()

  const deliveryNote = assignment.lieferscheinId && typeof assignment.lieferscheinId === 'object'
    ? assignment.lieferscheinId as { verantwortlich?: unknown }
    : null
  const responsible = asUser(deliveryNote?.verantwortlich)
  if (!userId && responsible) userId = objectIdString(responsible)
  if (!email && responsible?.email) email = responsible.email.trim().toLowerCase()
  if (!name && responsible?.name) name = responsible.name.trim()

  if (userId && (!email || !name)) {
    const account = await User.findById(userId).select({ email: 1, name: 1 }).lean<PopulatedUser | null>()
    if (!email && account?.email) email = account.email.trim().toLowerCase()
    if (!name && account?.name) name = account.name.trim()
  }

  // Rückwärtskompatibilität für Ausgaben, die vor dem Ausgeber-Snapshot angelegt wurden.
  if (!userId || !email) {
    const issuedAt = new Date(assignment.ausgabedatum)
    const rangeStart = new Date(issuedAt.getTime() - 12 * 60 * 60 * 1000)
    const rangeEnd = new Date(issuedAt.getTime() + 36 * 60 * 60 * 1000)
    const movement = await StockMovement.findOne({
      artikelId: objectIdString(assignment.artikelId),
      empfaenger: objectIdString(assignment.personId),
      bewegungstyp: 'ausgang',
      datum: { $gte: rangeStart, $lte: rangeEnd },
    })
      .sort({ datum: 1 })
      .populate('verantwortlich', 'name email')
      .lean<{ verantwortlich?: PopulatedUser | unknown } | null>()
    const movementUser = asUser(movement?.verantwortlich)
    if (!userId && movementUser) userId = objectIdString(movementUser)
    if (!email && movementUser?.email) email = movementUser.email.trim().toLowerCase()
    if (!name && movementUser?.name) name = movementUser.name.trim()
  }

  if (!userId && email) {
    const account = await User.findOne({ email }).select({ email: 1, name: 1 }).lean<PopulatedUser | null>()
    if (account) {
      userId = objectIdString(account)
      if (!name && account.name) name = account.name.trim()
    }
  }

  return userId && email ? { userId, email, name } : null
}

async function claimEmail(notificationId: unknown, now: Date) {
  const staleBefore = new Date(now.getTime() - STALE_PROCESSING_MS)
  const claimed = await ReturnReminderNotification.findOneAndUpdate(
    {
      _id: notificationId,
      $or: [
        { emailStatus: 'pending' },
        { emailStatus: 'failed', nextEmailAttemptAt: { $lte: now } },
        { emailStatus: 'failed', nextEmailAttemptAt: null },
        { emailStatus: 'processing', lastEmailAttemptAt: { $lte: staleBefore } },
      ],
    },
    {
      $set: { emailStatus: 'processing', lastEmailAttemptAt: now, emailError: '' },
      $inc: { emailAttempts: 1 },
    },
    { new: true }
  ).lean()
  return claimed as ReminderNotificationRecord | null
}

async function sendReminderEmail(
  notification: ReminderNotificationRecord,
  interval: ReturnReminderInterval,
  now: Date
) {
  const branding = await getEmailBranding()
  const dueDate = new Date(notification.dueDate)
  const dueDateText = new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(dueDate)
  const articleName = String(notification.articleName || 'Produkt')
  const employeeName = String(notification.employeeName || 'Mitarbeiter')
  const subject = `Rückgabe-Erinnerung: ${articleName} – ${dueDateText}`
  const baseUrl = appBaseUrl()
  const linkHtml = baseUrl
    ? `<p style="margin:24px 0"><a href="${escapeHtml(`${baseUrl}/lager`)}" style="background:#2563eb;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;display:inline-block">Offene Ausgaben ansehen</a></p>`
    : ''
  const greeting = notification.recipientName ? `Hallo ${escapeHtml(String(notification.recipientName))},` : 'Hallo,'
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#1f2937">
      <div style="background:#114F6B;color:white;padding:20px;border-radius:10px 10px 0 0">${branding.headerHtml}</div>
      <div style="background:#f8fafc;padding:28px;border-radius:0 0 10px 10px">
        <p>${greeting}</p>
        <h2 style="margin:16px 0;color:#0f172a">Anstehende Produktrückgabe</h2>
        <p>Sie haben <strong>${escapeHtml(articleName)}</strong> an <strong>${escapeHtml(employeeName)}</strong> ausgegeben.</p>
        <table style="border-collapse:collapse;width:100%;margin:20px 0">
          <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0">Geplante Rückgabe</td><td style="padding:8px;border-bottom:1px solid #e2e8f0"><strong>${dueDateText}</strong></td></tr>
          <tr><td style="padding:8px">Erinnerungszeitpunkt</td><td style="padding:8px">${escapeHtml(returnReminderIntervalLabel(interval))}</td></tr>
        </table>
        ${linkHtml}
        <p style="font-size:13px;color:#64748b">Diese Erinnerung wurde automatisch von ${escapeHtml(branding.companyName)} erstellt.</p>
      </div>
    </div>`
  const text = `${greeting}\n\n${articleName} wurde an ${employeeName} ausgegeben und ist bis ${dueDateText} zurückzugeben.\nErinnerungszeitpunkt: ${returnReminderIntervalLabel(interval)}.${baseUrl ? `\n\n${baseUrl}/lager` : ''}`

  const result = await sendEmailResult({
    to: String(notification.recipientEmail),
    subject,
    html,
    text,
    attachments: branding.attachment ? [branding.attachment] : undefined,
  })

  await ReturnReminderNotification.updateOne(
    { _id: notification._id },
    result.ok
      ? { $set: { emailStatus: 'sent', emailSentAt: now, emailError: '', nextEmailAttemptAt: null } }
      : {
          $set: {
            emailStatus: 'failed',
            emailError: result.error || 'E-Mail-Versand fehlgeschlagen',
            nextEmailAttemptAt: new Date(now.getTime() + RETRY_DELAY_MS),
          },
        }
  )

  try {
    await NotificationLog.create({
      key: RETURN_REMINDER_NOTIFICATION_KEY,
      to: notification.recipientEmail,
      subject,
      success: result.ok,
      errorMessage: result.error,
      projectName: 'Lager',
      attachmentsCount: branding.attachment ? 1 : 0,
      meta: {
        assignmentId: String(notification.assignmentId),
        articleName,
        employeeName,
        dueDate,
        interval: notification.interval,
        performedBy: 'Automatische Rückgabe-Erinnerung',
      },
    })
  } catch (logError) {
    logger.error('Rückgabe-Erinnerung konnte nicht protokolliert werden', logError)
  }

  return result.ok
}

export async function runReturnReminders(now = new Date()): Promise<ReturnReminderRunResult> {
  await dbConnect()
  const settings = await NotificationSettings.findOne({ scope: 'global' })
  const configuredEnabled = settings?.enabledByKey?.get?.(RETURN_REMINDER_NOTIFICATION_KEY)
  const enabled = configuredEnabled ?? true
  const result: ReturnReminderRunResult = {
    enabled,
    candidates: 0,
    created: 0,
    emailsSent: 0,
    emailsFailed: 0,
    skippedWithoutIssuer: 0,
  }
  if (!enabled) return result

  const rawConfig = settings?.configByKey?.get?.(RETURN_REMINDER_NOTIFICATION_KEY)
    ?? DEFAULT_RETURN_REMINDER_CONFIG
  const config = normalizeReturnReminderConfig(rawConfig)
  const activeIntervals = config.intervals.filter((interval) => interval.enabled)
  if (activeIntervals.length === 0) return result

  const timeZone = process.env.RETURN_REMINDER_TIMEZONE || DEFAULT_TIME_ZONE
  const todayKey = calendarDateKeyInTimeZone(now, timeZone)
  const rangeStart = new Date(`${todayKey}T00:00:00.000Z`)
  rangeStart.setUTCDate(rangeStart.getUTCDate() - 1)
  const rangeEnd = new Date(`${todayKey}T00:00:00.000Z`)
  rangeEnd.setUTCDate(rangeEnd.getUTCDate() + maxReminderHorizonDays(activeIntervals) + 3)

  const assignments = await ArticleAssignment.find({
    status: 'ausgegeben',
    geplanteRueckgabe: { $ne: null, $gte: rangeStart, $lt: rangeEnd },
  })
    .populate('artikelId', 'bezeichnung artikelnummer')
    .populate('personId', 'name')
    .populate({
      path: 'lieferscheinId',
      select: 'verantwortlich',
      populate: { path: 'verantwortlich', select: 'name email' },
    })
    .lean<AssignmentCandidate[]>()

  result.candidates = assignments.length

  for (const assignment of assignments) {
    const dueDate = new Date(assignment.geplanteRueckgabe)
    if (Number.isNaN(dueDate.getTime())) continue
    const dueInterval = activeIntervals.find((interval) =>
      isReturnReminderDue(dueDate, interval, now, timeZone)
    )
    if (!dueInterval) continue

    const issuer = await resolveIssuer(assignment)
    if (!issuer) {
      result.skippedWithoutIssuer += 1
      logger.warn('Rückgabe-Erinnerung ohne zuordenbaren Ausgeber übersprungen', {
        assignmentId: String(assignment._id),
      })
      continue
    }

    const article = assignment.artikelId && typeof assignment.artikelId === 'object'
      ? assignment.artikelId as PopulatedArticle
      : null
    const employee = assignment.personId && typeof assignment.personId === 'object'
      ? assignment.personId as PopulatedEmployee
      : null
    const articleName = String(article?.bezeichnung || article?.artikelnummer || 'Produkt')
    const employeeName = String(employee?.name || 'Mitarbeiter')
    // Pro Ausgabe und Kalendertag höchstens eine Erinnerung, auch wenn zwei Regeln
    // (z. B. 14 Tage und 2 Wochen) auf dasselbe Datum fallen.
    const uniqueKey = `${String(assignment._id)}:${todayKey}`
    const createResult = await ReturnReminderNotification.updateOne(
      { uniqueKey },
      {
        $setOnInsert: {
          uniqueKey,
          assignmentId: assignment._id,
          recipientUserId: issuer.userId,
          recipientEmail: issuer.email,
          recipientName: issuer.name,
          articleId: objectIdString(assignment.artikelId) || undefined,
          articleName,
          articleNumber: String(article?.artikelnummer || ''),
          employeeId: objectIdString(assignment.personId) || undefined,
          employeeName,
          dueDate,
          reminderDate: todayKey,
          interval: {
            value: dueInterval.value,
            unit: dueInterval.unit,
            label: returnReminderIntervalLabel(dueInterval),
          },
          message: returnReminderMessage(articleName, employeeName, dueDate),
          emailStatus: 'pending',
        },
      },
      { upsert: true }
    )
    if (createResult.upsertedCount > 0) result.created += 1

    const notification = await ReturnReminderNotification.findOne({ uniqueKey }).lean() as { _id: unknown } | null
    if (!notification) continue
    const claimed = await claimEmail(notification._id, now)
    if (!claimed) continue

    const sent = await sendReminderEmail(claimed, dueInterval, now)
    if (sent) result.emailsSent += 1
    else result.emailsFailed += 1
  }

  // Falls SMTP vorübergehend nicht erreichbar war oder ein Lauf zwischen
  // Erstellen und Versenden abgebrochen ist, wird die bereits vorhandene
  // Benachrichtigung unabhängig vom ursprünglichen Erinnerungsdatum erneut
  // verarbeitet. Die atomare Claim-Operation verhindert Doppelversand.
  const staleBefore = new Date(now.getTime() - STALE_PROCESSING_MS)
  const retryableNotifications = await ReturnReminderNotification.find({
    resolvedAt: null,
    $or: [
      { emailStatus: 'pending' },
      { emailStatus: 'failed', nextEmailAttemptAt: { $lte: now } },
      { emailStatus: 'failed', nextEmailAttemptAt: null },
      { emailStatus: 'processing', lastEmailAttemptAt: { $lte: staleBefore } },
    ],
  })
    .sort({ createdAt: 1 })
    .limit(100)
    .lean<ReminderNotificationRecord[]>()

  for (const notification of retryableNotifications) {
    const claimed = await claimEmail(notification._id, now)
    if (!claimed) continue
    const storedInterval = claimed.interval as { value?: unknown; unit?: unknown } | undefined
    const interval: ReturnReminderInterval = {
      id: 'retry',
      value: Number(storedInterval?.value ?? 0),
      unit: storedInterval?.unit === 'weeks' || storedInterval?.unit === 'months' ? storedInterval.unit : 'days',
      enabled: true,
    }
    const sent = await sendReminderEmail(claimed, interval, now)
    if (sent) result.emailsSent += 1
    else result.emailsFailed += 1
  }

  return result
}
