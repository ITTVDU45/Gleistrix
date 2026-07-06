'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import AgentDetailShell from '@/components/agents/AgentDetailShell'
import { AGENT_VIEWS } from '@/components/agents/agentViewRegistry'
import { AgentsApi } from '@/lib/api/agents'
import type { Agent } from '@/types/agents'

export default function AgentDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const [agent, setAgent] = useState<Agent | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    AgentsApi.getAgentById(slug)
      .then((data) => {
        if (!cancelled) setAgent(data)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [slug])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (!agent) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-800 dark:bg-red-900/20">
        <AlertTriangle className="mx-auto h-8 w-8 text-red-500" />
        <p className="mt-2 font-medium text-red-700 dark:text-red-300">Agent nicht gefunden</p>
        <Button asChild variant="outline" size="sm" className="mt-4">
          <Link href="/agenten">Zurück zur Übersicht</Link>
        </Button>
      </div>
    )
  }

  const AgentView = AGENT_VIEWS[agent.slug]

  return (
    <AgentDetailShell agent={agent}>
      {AgentView ? (
        <AgentView />
      ) : (
        <p className="rounded-2xl border border-dashed border-slate-300 py-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          Für diesen Agenten ist noch keine Detailansicht hinterlegt.
        </p>
      )}
    </AgentDetailShell>
  )
}
