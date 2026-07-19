import dbConnect from '@/lib/dbConnect'
import FeatureFlagSettings from '@/lib/models/FeatureFlagSettings'
import { logger } from '@/lib/logger'

/**
 * Bekannte Feature-Flags inkl. Default-Wert. Defaults sind aktiviert, damit das
 * Portal ohne Zusatzschritt nutzbar ist; per Einstellungen/DB abschaltbar.
 * ENV-Override: FEATURE_<NAME>=true|false (z. B. FEATURE_SUBCONTRACTORPORTALENABLED=false).
 */
export const DEFAULT_FEATURE_FLAGS = {
  subcontractorPortalEnabled: true,
  receivedInvoicesEnabled: true,
  subcontractorInvitationsEnabled: true,
} as const

export type FeatureFlagKey = keyof typeof DEFAULT_FEATURE_FLAGS

function envOverride(key: FeatureFlagKey): boolean | undefined {
  const raw = process.env[`FEATURE_${key.toUpperCase()}`]
  if (raw === undefined) return undefined
  return raw === 'true' || raw === '1'
}

/** Liest alle Flags (DB > ENV > Default). */
export async function getFeatureFlags(): Promise<Record<FeatureFlagKey, boolean>> {
  const result: Record<FeatureFlagKey, boolean> = { ...DEFAULT_FEATURE_FLAGS }
  for (const key of Object.keys(DEFAULT_FEATURE_FLAGS) as FeatureFlagKey[]) {
    const env = envOverride(key)
    if (env !== undefined) result[key] = env
  }
  try {
    await dbConnect()
    const doc = await FeatureFlagSettings.findOne({ scope: 'global' }).lean() as { flags?: Record<string, boolean> } | null
    const stored = doc?.flags
    if (stored) {
      const entries = stored instanceof Map ? Array.from(stored.entries()) : Object.entries(stored)
      for (const [key, value] of entries) {
        if (key in result && typeof value === 'boolean') {
          result[key as FeatureFlagKey] = value
        }
      }
    }
  } catch (error) {
    // Bei DB-Problemen Defaults verwenden statt das Portal hart zu blockieren
    logger.warn('FeatureFlags: Konnte Einstellungen nicht laden, verwende Defaults', error)
  }
  return result
}

export async function isFeatureEnabled(key: FeatureFlagKey): Promise<boolean> {
  const flags = await getFeatureFlags()
  return flags[key]
}

/** Speichert Flag-Werte (nur bekannte Keys). */
export async function setFeatureFlags(update: Partial<Record<FeatureFlagKey, boolean>>): Promise<Record<FeatureFlagKey, boolean>> {
  await dbConnect()
  const doc = await FeatureFlagSettings.findOneAndUpdate(
    { scope: 'global' },
    {},
    { new: true, upsert: true, setDefaultsOnInsert: true }
  )
  for (const [key, value] of Object.entries(update)) {
    if (key in DEFAULT_FEATURE_FLAGS && typeof value === 'boolean') {
      doc.flags.set(key, value)
    }
  }
  await doc.save()
  return getFeatureFlags()
}
