import type { ComponentType } from 'react'
import MangelAgentView from './mangel/MangelAgentView'
import LvAgentView from './lv/LvAgentView'
import GaebAgentView from './gaeb/GaebAgentView'

/**
 * Registry: Agent-slug → agent-spezifische Detail-View.
 * Neue Agenten werden hier ergänzt (plus Mock/API + Eintrag in MOCK_AGENTS).
 */
export const AGENT_VIEWS: Record<string, ComponentType> = {
  mangel: MangelAgentView,
  lv: LvAgentView,
  gaeb: GaebAgentView,
}
