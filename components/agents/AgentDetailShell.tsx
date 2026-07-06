'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import DynamicIcon from '@/components/shared/DynamicIcon'
import { toneStyle } from '@/components/shared/toneStyles'
import AgentStatusBadge from './AgentStatusBadge'
import type { Agent, AgentAction, AgentActivity, AgentMetric } from '@/types/agents'

interface AgentDetailShellProps {
  agent: Agent
  children: React.ReactNode
}

function activityToneClass(level: AgentActivity['level']): string {
  switch (level) {
    case 'fehler':
      return 'bg-red-500'
    case 'warnung':
      return 'bg-amber-500'
    case 'erfolg':
      return 'bg-emerald-500'
    default:
      return 'bg-blue-500'
  }
}

function MetricPill({ metric }: { metric: AgentMetric }) {
  const styles = toneStyle(metric.tone)
  return (
    <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <CardContent className="p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
          {metric.label}
        </p>
        <p className={`mt-1 text-2xl font-bold tabular-nums ${styles.accent}`}>
          {metric.value}
          {metric.unit ? <span className="ml-1 text-sm font-medium text-slate-400">{metric.unit}</span> : null}
        </p>
      </CardContent>
    </Card>
  )
}

/**
 * Gemeinsames Gerüst für Agenten-Detailseiten: Kopf mit Status/Zurück,
 * Kennzahlen, Quick Actions und Aktivitäts-Feed. Der agent-spezifische Inhalt
 * wird als `children` übergeben – so bleiben die Detail-Views modular.
 */
export default function AgentDetailShell({ agent, children }: AgentDetailShellProps) {
  return (
    <div className="space-y-6">
      {/* Kopfbereich */}
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2 gap-1 text-slate-500">
          <Link href="/agenten">
            <ArrowLeft className="h-4 w-4" /> Alle Agenten
          </Link>
        </Button>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-blue-50 p-3 ring-1 ring-blue-100 dark:bg-blue-900/30 dark:ring-blue-800">
              <DynamicIcon name={agent.icon} className="h-7 w-7 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{agent.name}</h1>
              <p className="max-w-2xl text-sm text-slate-600 dark:text-slate-400">{agent.description}</p>
            </div>
          </div>
          <AgentStatusBadge status={agent.status} />
        </div>
      </div>

      {/* Kennzahlen */}
      {agent.metrics && agent.metrics.length > 0 && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {agent.metrics.map((m) => (
            <MetricPill key={m.id} metric={m} />
          ))}
        </div>
      )}

      {/* Quick Actions */}
      {agent.actions && agent.actions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {agent.actions.map((action: AgentAction) => (
            <Button key={action.id} variant="outline" size="sm" disabled={action.disabled} title={action.description}>
              {action.label}
            </Button>
          ))}
        </div>
      )}

      {/* Agent-spezifischer Inhalt */}
      {children}

      {/* Letzte Aktivitäten */}
      {agent.activities && agent.activities.length > 0 && (
        <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <CardContent className="p-5">
            <h3 className="mb-4 text-sm font-semibold text-slate-800 dark:text-slate-100">Letzte Aktivitäten</h3>
            <ul className="space-y-3">
              {agent.activities.map((a) => (
                <li key={a.id} className="flex items-start gap-3">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${activityToneClass(a.level)}`} />
                  <div>
                    <p className="text-sm text-slate-700 dark:text-slate-200">{a.message}</p>
                    <p className="text-xs text-slate-400">
                      {new Date(a.timestamp).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
