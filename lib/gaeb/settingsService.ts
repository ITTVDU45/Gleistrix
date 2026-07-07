import dbConnect from '@/lib/dbConnect'
import IntegrationConfig from '@/lib/models/IntegrationConfig'
import { mergeGaebSettings } from '@/lib/gaeb/registry'
import type { GaebIntegrationSettings } from '@/types/gaeb'

const INTEGRATION_ID = 'gaeb'

/**
 * Lädt die aktuellen GAEB-Einstellungen (mit Defaults zusammengeführt).
 * Serverseitig genutzt von Upload-/Import-Routen.
 */
export async function loadGaebSettings(): Promise<GaebIntegrationSettings> {
  await dbConnect()
  const doc = (await IntegrationConfig.findOne({ integrationId: INTEGRATION_ID }).lean()) as
    | Record<string, unknown>
    | null
  return mergeGaebSettings((doc?.config as Partial<GaebIntegrationSettings>) ?? null)
}
