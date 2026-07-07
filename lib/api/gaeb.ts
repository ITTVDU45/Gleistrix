/**
 * Client-Service für die GAEB-Integration.
 *
 * Kapselt die HTTP-Aufrufe (analog zu lib/api/lager.ts). Aktuell nur die
 * Konfiguration; Upload/Import/Historie folgen in späteren Phasen und werden
 * hier ergänzt, sodass UI und späterer GAEB-Agent einen stabilen Vertrag haben.
 */

import { getJSON, postJSON, delJSON } from '@/lib/http/apiClient'
import { fetchWithIntent } from '@/lib/http/fetchWithIntent'
import type {
  GaebIntegrationSettings,
  GaebImportStatus,
  GaebVersionId,
  GaebExchangePhaseCode,
  GaebValidationResult,
  GaebBillOfQuantities,
} from '@/types/gaeb'

export interface GaebConfigResponse {
  success: boolean
  data: {
    settings: GaebIntegrationSettings
    status: string
  }
}

/** Zeile der Import-Historie (angereichert mit Datei-Metadaten). */
export interface GaebImportListItem {
  importJobId: string
  fileId: string
  originalName: string
  sizeBytes: number
  status: GaebImportStatus
  version: GaebVersionId | null
  phase: GaebExchangePhaseCode | null
  error: string | null
  createdAt: string
}

export interface GaebUploadResult {
  importJobId: string
  fileId: string
  originalName: string
  sizeBytes: number
  sha256: string
  status: GaebImportStatus
}

export const GaebApi = {
  config: {
    get: () => getJSON<GaebConfigResponse>('/api/integrations/gaeb/config'),
    save: (settings: GaebIntegrationSettings) =>
      postJSON<GaebConfigResponse>(
        '/api/integrations/gaeb/config',
        settings as unknown as Record<string, unknown>,
        'integrations:gaeb-config'
      ),
  },

  /** GAEB-Datei hochladen (FormData). */
  upload: async (file: File): Promise<{ success: boolean; data: GaebUploadResult }> => {
    const form = new FormData()
    form.append('file', file)
    const res = await fetchWithIntent('/api/gaeb/upload', {
      method: 'POST',
      intent: 'gaeb:upload',
      body: form,
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok || !json?.success) {
      throw new Error(json?.error || 'Upload fehlgeschlagen')
    }
    return json
  },

  imports: {
    list: () => getJSON<{ success: boolean; data: GaebImportListItem[] }>('/api/gaeb/imports'),
    get: (id: string) =>
      getJSON<{
        success: boolean
        data: {
          job: Record<string, unknown>
          file: Record<string, unknown> | null
          boq: GaebBillOfQuantities | null
        }
      }>(`/api/gaeb/imports/${id}`),
    validate: (id: string) =>
      postJSON<{
        success: boolean
        data: { ok: boolean; status: GaebImportStatus; validation: GaebValidationResult; boqId?: string; positionCount?: number }
      }>(`/api/gaeb/imports/${id}/validate`, undefined, 'gaeb:validate'),
    remove: (id: string) => delJSON<{ success: boolean }>(`/api/gaeb/imports/${id}`, 'gaeb:import-delete'),
  },
}
