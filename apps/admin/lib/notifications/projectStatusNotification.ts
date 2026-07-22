import { logger } from '@/lib/logger';
import { createPDFForProjectDays } from '@/lib/pdfExport';
import { getEmailBranding, sendEmailResult } from '@/lib/mailer';
import NotificationLog from '@/lib/models/NotificationLog';
import { notificationKeyForProjectStatus } from '@/lib/notificationDefs';
import { getNotificationRule } from './notificationSettings';

const STATUS_LABELS: Record<string, string> = {
  abgeschlossen: 'abgeschlossen',
  fertiggestellt: 'fertiggestellt',
  teilweise_abgerechnet: 'teilweise abgerechnet',
  geleistet: 'vollständig abgerechnet (geleistet)',
};

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function safeFilename(value: unknown): string {
  const normalized = String(value || 'Projekt').replace(/[^a-zA-Z0-9äöüÄÖÜß._-]+/g, '_');
  return normalized.slice(0, 100) || 'Projekt';
}

export interface ProjectStatusNotificationResult {
  attempted: boolean;
  sent: boolean;
  reason?: 'unchanged' | 'not-configured' | 'disabled' | 'missing-recipient';
  error?: string;
}

/**
 * Zentraler Versand für Statuswechsel. Fehler werden protokolliert, blockieren
 * aber niemals die fachliche Statusänderung.
 */
export async function sendProjectStatusNotification(options: {
  project: any;
  previousStatus?: unknown;
  performedBy?: string;
}): Promise<ProjectStatusNotificationResult> {
  const { project, previousStatus, performedBy = 'System' } = options;
  const status = String(project?.status || '');
  if (previousStatus !== undefined && String(previousStatus) === status) {
    return { attempted: false, sent: false, reason: 'unchanged' };
  }

  const key = notificationKeyForProjectStatus(status);
  if (!key) return { attempted: false, sent: false, reason: 'not-configured' };

  try {
    const rule = await getNotificationRule(key);
    if (!rule.enabled) return { attempted: false, sent: false, reason: 'disabled' };
    if (!rule.to) {
      const error = 'Keine gültige Empfänger-E-Mail konfiguriert';
      await createNotificationLog({ project, key, to: '', subject: project?.name || 'Projektstatus', performedBy, success: false, error });
      return { attempted: true, sent: false, reason: 'missing-recipient', error };
    }

    const branding = await getEmailBranding();
    const statusLabel = STATUS_LABELS[status] || status;
    const projectName = String(project?.name || 'Unbenanntes Projekt');
    const days = Object.keys(project?.mitarbeiterZeiten || {}).sort();
    const attachments = [] as Array<{ filename: string; content: Buffer | string; contentType?: string; cid?: string }>;

    try {
      const pdf = await createPDFForProjectDays(project, days);
      attachments.push({
        filename: `Projektdetails_${safeFilename(projectName)}.pdf`,
        content: pdf,
        contentType: 'application/pdf',
      });
    } catch (pdfError) {
      logger.warn('Projektstatus-PDF konnte nicht erstellt werden; E-Mail wird ohne PDF gesendet', pdfError);
    }
    if (branding.attachment) attachments.push(branding.attachment);

    const subject = `Projektstatus geändert: ${projectName} – ${statusLabel}`;
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#1f2937">
        <div style="background:#114F6B;color:#fff;padding:20px;border-radius:10px 10px 0 0">${branding.headerHtml}</div>
        <div style="background:#f8fafc;padding:28px;border-radius:0 0 10px 10px">
          <h2 style="margin-top:0;color:#0f172a">Projektstatus geändert</h2>
          <p>Das Projekt <strong>${escapeHtml(projectName)}</strong> wurde auf <strong>${escapeHtml(statusLabel)}</strong> gesetzt.</p>
          <table style="border-collapse:collapse;width:100%;margin:20px 0">
            <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0">Auftraggeber</td><td style="padding:8px;border-bottom:1px solid #e2e8f0">${escapeHtml(project?.auftraggeber || '-')}</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0">Baustelle</td><td style="padding:8px;border-bottom:1px solid #e2e8f0">${escapeHtml(project?.baustelle || '-')}</td></tr>
            <tr><td style="padding:8px">Auftragsnummer</td><td style="padding:8px">${escapeHtml(project?.auftragsnummer || '-')}</td></tr>
          </table>
          <p style="font-size:13px;color:#64748b">Diese Nachricht wurde automatisch von ${escapeHtml(branding.companyName)} erstellt.</p>
        </div>
      </div>`;

    const result = await sendEmailResult({
      to: rule.to,
      subject,
      html,
      text: `Das Projekt ${projectName} wurde auf ${statusLabel} gesetzt.`,
      attachments: attachments.length > 0 ? attachments : undefined,
    });

    await createNotificationLog({
      project,
      key,
      to: rule.to,
      subject,
      performedBy,
      success: result.ok,
      error: result.error,
      attachmentsCount: attachments.length,
      previousStatus,
    });
    return { attempted: true, sent: result.ok, error: result.error };
  } catch (error) {
    logger.error('Projektstatus-Benachrichtigung fehlgeschlagen', error);
    return { attempted: true, sent: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function createNotificationLog(options: {
  project: any;
  key: string;
  to: string;
  subject: string;
  performedBy: string;
  success: boolean;
  error?: string;
  attachmentsCount?: number;
  previousStatus?: unknown;
}) {
  try {
    await NotificationLog.create({
      key: options.key,
      to: options.to || '(nicht konfiguriert)',
      subject: options.subject,
      success: options.success,
      errorMessage: options.error,
      projectId: options.project?._id,
      projectName: options.project?.name,
      attachmentsCount: options.attachmentsCount || 0,
      meta: {
        previousStatus: options.previousStatus,
        status: options.project?.status,
        performedBy: options.performedBy,
      },
    });
  } catch (logError) {
    logger.error('Projektstatus-Benachrichtigung konnte nicht protokolliert werden', logError);
  }
}
