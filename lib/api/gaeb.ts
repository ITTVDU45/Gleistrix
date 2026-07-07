/**
 * Client-Service für die GAEB-Integration.
 *
 * Kapselt die HTTP-Aufrufe (analog zu lib/api/lager.ts). Aktuell nur die
 * Konfiguration; Upload/Import/Historie folgen in späteren Phasen und werden
 * hier ergänzt, sodass UI und späterer GAEB-Agent einen stabilen Vertrag haben.
 */

import { getJSON, postJSON } from '@/lib/http/apiClient'
import type { GaebIntegrationSettings } from '@/types/gaeb'

export interface GaebConfigResponse {
  success: boolean
  data: {
    settings: GaebIntegrationSettings
    status: string
  }
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
}
