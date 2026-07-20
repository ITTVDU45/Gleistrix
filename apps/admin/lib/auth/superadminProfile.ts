import dbConnect from '@/lib/dbConnect'
import SuperadminProfile from '@/lib/models/SuperadminProfile'
import { logger } from '@/lib/logger'

export interface SuperadminOverride {
  name?: string
  phone?: string
}

/**
 * Liest die im Profil gespeicherten Overrides des ENV-Superadmins (Name/Telefon).
 * Diese sind die maßgebliche Quelle für den angezeigten Namen (Sidebar, E-Mail-
 * Signatur etc.), da der ENV-Superadmin kein users-Dokument besitzt und der
 * JWT-Name erst beim nächsten Login aktualisiert würde. Wirft nie.
 */
export async function getSuperadminOverride(): Promise<SuperadminOverride> {
  try {
    await dbConnect()
    const doc = (await SuperadminProfile.findOne({ scope: 'env-superadmin' }).lean()) as
      | { name?: string; phone?: string }
      | null
    return { name: doc?.name?.trim() || undefined, phone: doc?.phone || undefined }
  } catch (error) {
    logger.warn('Superadmin-Profil-Override konnte nicht geladen werden', error)
    return {}
  }
}

/** Effektiver Anzeigename des ENV-Superadmins: Override > JWT-Name > 'Super Admin'. */
export async function resolveSuperadminName(tokenName?: string | null): Promise<string> {
  const override = await getSuperadminOverride()
  return override.name || (tokenName && tokenName.trim()) || 'Super Admin'
}
