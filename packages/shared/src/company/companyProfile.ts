import dbConnect from '@/lib/dbConnect'
import CompanyProfile from '@/lib/models/CompanyProfile'
import { logger } from '@/lib/logger'

export interface CompanyProfileData {
  companyName: string
  logoBase64?: string
  logoContentType?: string
}

/** Entfernt umschließende Anführungszeichen (z. B. aus ENV-Werten). */
function stripQuotes(value: string): string {
  return value.trim().replace(/^["']|["']$/g, '').trim()
}

/** Fallback-Firmenname aus ENV (ohne Anführungszeichen). */
export function envCompanyName(): string {
  const raw =
    process.env.EMAIL_COMPANY_NAME ||
    process.env.COMPANY_NAME ||
    process.env.EMAIL_FROM_NAME ||
    'Mülheimer Wachdienst GmbH'
  return stripQuotes(raw)
}

/**
 * Firmenprofil laden (DB > ENV-Fallback für den Namen). Wirft nie – bei
 * DB-Problemen wird der ENV-Fallback zurückgegeben.
 */
export async function getCompanyProfile(): Promise<CompanyProfileData> {
  const fallback: CompanyProfileData = { companyName: envCompanyName() }
  try {
    await dbConnect()
    const doc = (await CompanyProfile.findOne({ scope: 'global' }).lean()) as {
      companyName?: string
      logoBase64?: string
      logoContentType?: string
    } | null
    if (!doc) return fallback
    return {
      companyName: (doc.companyName && doc.companyName.trim()) || fallback.companyName,
      logoBase64: doc.logoBase64 || undefined,
      logoContentType: doc.logoContentType || undefined,
    }
  } catch (error) {
    logger.warn('Firmenprofil konnte nicht geladen werden – ENV-Fallback', error)
    return fallback
  }
}
