import { timingSafeEqual } from 'node:crypto'

/** Feste User-ID im JWT für den rein über ENV konfigurierten Super-Admin (kein MongoDB-Dokument). */
export const ENV_SUPERADMIN_JWT_ID = 'env-superadmin'

export function isEnvSuperadminJwtToken(token: { id?: string; role?: string }): boolean {
  return token.id === ENV_SUPERADMIN_JWT_ID && token.role === 'superadmin'
}

function timingSafeStringEqual(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, 'utf8')
    const bb = Buffer.from(b, 'utf8')
    if (ba.length !== bb.length) return false
    return timingSafeEqual(ba, bb)
  } catch {
    return false
  }
}

/**
 * Prüft E-Mail/Passwort gegen SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD.
 * Wenn SUPERADMIN_EMAIL gesetzt ist, gilt nur dieses Passwort für diese Adresse (kein DB-Fallback).
 */
export function matchEnvSuperadminCredentials(email: string, password: string): boolean {
  const configuredEmail = process.env.SUPERADMIN_EMAIL?.trim().toLowerCase() ?? ''
  const configuredPass = process.env.SUPERADMIN_PASSWORD ?? ''
  if (!configuredEmail || !configuredPass) return false
  const normalized = email.trim().toLowerCase()
  if (normalized !== configuredEmail) return false
  return timingSafeStringEqual(password, configuredPass)
}

export function envSuperadminDisplayName(): string {
  return process.env.SUPERADMIN_NAME?.trim() || 'Super Admin'
}
