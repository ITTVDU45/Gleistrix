import { createHash, randomBytes } from 'crypto'

/**
 * Einladungstoken für Subunternehmen: In der DB wird ausschließlich der
 * SHA-256-Hash gespeichert; der Klartext existiert nur im Einladungslink.
 */
export function generateInviteToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString('base64url')
  return { token, tokenHash: hashInviteToken(token) }
}

export function hashInviteToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

export type InviteValidationResult =
  | { valid: true }
  | { valid: false; reason: 'expired' | 'revoked' | 'used' }

export interface InviteLike {
  used?: boolean
  revokedAt?: Date | string | null
  expiresAt: Date | string
}

/** Reine Statusprüfung einer Einladung (einmalig, nicht widerrufen, nicht abgelaufen). */
export function validateInviteState(invite: InviteLike, now: Date = new Date()): InviteValidationResult {
  if (invite.used) return { valid: false, reason: 'used' }
  if (invite.revokedAt) return { valid: false, reason: 'revoked' }
  if (new Date(invite.expiresAt).getTime() <= now.getTime()) return { valid: false, reason: 'expired' }
  return { valid: true }
}
