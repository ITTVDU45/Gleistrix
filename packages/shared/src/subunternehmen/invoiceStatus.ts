import type { ReceivedInvoiceStatus } from '@/types/subunternehmen'

export type StatusActor = 'subcontractor' | 'internal'

/**
 * Erlaubte Statusübergänge inkl. Akteur.
 * - Subunternehmen: erstellen/bearbeiten/einreichen/stornieren von Entwürfen,
 *   Revision nach Rückfrage.
 * - Intern: Prüfung, Rückfrage, Ablehnung, Freigabe, Zahlung.
 */
const TRANSITIONS: Record<ReceivedInvoiceStatus, Partial<Record<ReceivedInvoiceStatus, StatusActor[]>>> = {
  DRAFT: {
    SUBMITTED: ['subcontractor'],
    CANCELLED: ['subcontractor'],
  },
  SUBMITTED: {
    UNDER_REVIEW: ['internal'],
    CHANGES_REQUESTED: ['internal'],
    APPROVED: ['internal'],
    REJECTED: ['internal'],
  },
  UNDER_REVIEW: {
    CHANGES_REQUESTED: ['internal'],
    APPROVED: ['internal'],
    REJECTED: ['internal'],
  },
  CHANGES_REQUESTED: {
    // Revision: zurück in den Entwurf (version+1), dann erneut einreichen
    DRAFT: ['subcontractor'],
    SUBMITTED: ['subcontractor'],
    CANCELLED: ['subcontractor'],
    REJECTED: ['internal'],
  },
  APPROVED: {
    SCHEDULED_FOR_PAYMENT: ['internal'],
    PAID: ['internal'],
  },
  REJECTED: {},
  SCHEDULED_FOR_PAYMENT: {
    PAID: ['internal'],
  },
  PAID: {},
  CANCELLED: {},
}

export function canTransition(
  from: ReceivedInvoiceStatus,
  to: ReceivedInvoiceStatus,
  actor: StatusActor
): boolean {
  const allowed = TRANSITIONS[from]?.[to]
  return Array.isArray(allowed) && allowed.includes(actor)
}

/** Statuswechsel, die zwingend eine Begründung/Nachricht benötigen */
export function requiresMessage(to: ReceivedInvoiceStatus): boolean {
  return to === 'CHANGES_REQUESTED' || to === 'REJECTED'
}

/** Entwürfe (und nur diese) sind frei editier- und löschbar */
export function isEditableBySubcontractor(status: ReceivedInvoiceStatus): boolean {
  return status === 'DRAFT'
}

export function isDeletableBySubcontractor(status: ReceivedInvoiceStatus): boolean {
  return status === 'DRAFT'
}

export const STATUS_LABELS: Record<ReceivedInvoiceStatus, string> = {
  DRAFT: 'Entwurf',
  SUBMITTED: 'Eingereicht',
  UNDER_REVIEW: 'In Prüfung',
  CHANGES_REQUESTED: 'Rückfrage',
  APPROVED: 'Freigegeben',
  REJECTED: 'Abgelehnt',
  SCHEDULED_FOR_PAYMENT: 'Zur Zahlung vorgesehen',
  PAID: 'Bezahlt',
  CANCELLED: 'Storniert',
}
