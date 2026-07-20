'use client'

import type { AgentStatus } from '@/types/agents'
import type { Tone } from '@/components/shared/toneStyles'
import { toneStyle } from '@/components/shared/toneStyles'

const STATUS_META: Record<AgentStatus, { label: string; tone: Tone }> = {
  aktiv: { label: 'Aktiv', tone: 'positive' },
  inaktiv: { label: 'Inaktiv', tone: 'default' },
  wartung: { label: 'Wartung', tone: 'warning' },
  fehler: { label: 'Fehler', tone: 'critical' },
  entwurf: { label: 'Entwurf', tone: 'info' },
}

interface AgentStatusBadgeProps {
  status: AgentStatus
}

export default function AgentStatusBadge({ status }: AgentStatusBadgeProps) {
  const meta = STATUS_META[status] ?? STATUS_META.inaktiv
  const styles = toneStyle(meta.tone)
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${styles.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${styles.bar}`} />
      {meta.label}
    </span>
  )
}

export const AGENT_STATUS_META = STATUS_META
