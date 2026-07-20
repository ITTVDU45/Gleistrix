/**
 * Service-Layer für das Agenten-Modul.
 *
 * Aktuell mock-basiert (keine Backend-Endpunkte vorhanden). Die Funktionen sind
 * bereits async/Promise-basiert, damit sie später 1:1 durch echte Fetches
 * (getJSON aus '@/lib/http/apiClient') ersetzt werden können, ohne dass die
 * aufrufenden Komponenten angepasst werden müssen.
 */

import type { Agent, MangelItem, LvDocument, LvPosition, LvRisk, LvNextStep } from '@/types/agents'
import {
  MOCK_AGENTS,
  getMockAgentBySlug,
  MOCK_MANGEL_ITEMS,
  MOCK_LV_DOCUMENTS,
  MOCK_LV_POSITIONS,
  MOCK_LV_RISKS,
  MOCK_LV_NEXT_STEPS,
} from '@/lib/mock/agents'

/** Simuliert eine minimale Netzwerklatenz für realistisches Verhalten. */
function resolve<T>(data: T): Promise<T> {
  return Promise.resolve(data)
}

export const AgentsApi = {
  /** Alle verfügbaren Agenten (Übersichtsseite). */
  getAgents: (): Promise<Agent[]> => resolve(MOCK_AGENTS),

  /** Einzelnen Agenten per slug oder id laden. */
  getAgentById: (idOrSlug: string): Promise<Agent | null> =>
    resolve(getMockAgentBySlug(idOrSlug) ?? null),

  // --- Mängel-Agent ---
  getMangelItems: (): Promise<MangelItem[]> => resolve(MOCK_MANGEL_ITEMS),

  // --- LV-Agent ---
  getLvDocuments: (): Promise<LvDocument[]> => resolve(MOCK_LV_DOCUMENTS),
  getLvPositions: (): Promise<LvPosition[]> => resolve(MOCK_LV_POSITIONS),
  getLvRisks: (): Promise<LvRisk[]> => resolve(MOCK_LV_RISKS),
  getLvNextSteps: (): Promise<LvNextStep[]> => resolve(MOCK_LV_NEXT_STEPS),
}
