'use client'

import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowRight, Clock } from 'lucide-react'
import DynamicIcon from '@/components/shared/DynamicIcon'
import AgentStatusBadge from './AgentStatusBadge'
import type { Agent, AgentCategory } from '@/types/agents'

const CATEGORY_LABELS: Record<AgentCategory, string> = {
  lager: 'Lagerverwaltung',
  ausschreibung: 'Ausschreibungen',
  projekt: 'Projekte',
  qualitaet: 'Qualität',
  allgemein: 'Allgemein',
}

function formatRelative(iso?: string): string {
  if (!iso) return 'Keine Aktivität'
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return '–'
  const diffMs = Date.now() - then
  const mins = Math.round(diffMs / 60000)
  if (mins < 1) return 'gerade eben'
  if (mins < 60) return `vor ${mins} Min.`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `vor ${hours} Std.`
  const days = Math.round(hours / 24)
  return `vor ${days} Tag${days === 1 ? '' : 'en'}`
}

interface AgentCardProps {
  agent: Agent
}

export default function AgentCard({ agent }: AgentCardProps) {
  return (
    <Card className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-800">
      <CardContent className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-blue-50 p-3 ring-1 ring-blue-100 dark:bg-blue-900/30 dark:ring-blue-800">
              <DynamicIcon name={agent.icon} className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">{agent.name}</h3>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {CATEGORY_LABELS[agent.category]}
              </p>
            </div>
          </div>
          <AgentStatusBadge status={agent.status} />
        </div>

        <p className="mt-3 line-clamp-3 text-sm text-slate-600 dark:text-slate-300">{agent.description}</p>

        {agent.metrics && agent.metrics.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {agent.metrics.slice(0, 3).map((m) => (
              <span
                key={m.id}
                className="rounded-lg bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-100 dark:bg-slate-700/40 dark:text-slate-300 dark:ring-slate-700"
              >
                {m.label}: <span className="font-semibold text-slate-900 dark:text-white">{m.value}</span>
              </span>
            ))}
          </div>
        )}

        <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 dark:border-slate-700">
          <span className="flex items-center gap-1.5 text-xs text-slate-400">
            <Clock className="h-3.5 w-3.5" />
            {formatRelative(agent.lastActivityAt)}
          </span>
          <Button asChild size="sm" className="gap-1">
            <Link href={`/agenten/${agent.slug}`}>
              Öffnen <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
