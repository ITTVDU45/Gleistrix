'use client'

import { useEffect, useState } from 'react'
import { Bot } from 'lucide-react'
import AgentCard from './AgentCard'
import { AgentsApi } from '@/lib/api/agents'
import type { Agent } from '@/types/agents'

export default function AgentsOverview() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    AgentsApi.getAgents()
      .then((data) => {
        if (!cancelled) setAgents(data)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Agenten</h1>
          <p className="mt-1 text-slate-600 dark:text-slate-400">
            Übersicht der KI-gestützten und regelbasierten Agenten im Gleistrix-System
          </p>
        </div>
        <div className="hidden rounded-2xl bg-blue-50 p-3 ring-1 ring-blue-100 dark:bg-blue-900/30 dark:ring-blue-800 sm:block">
          <Bot className="h-6 w-6 text-blue-600 dark:text-blue-400" />
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-56 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
          ))}
        </div>
      ) : agents.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          Noch keine Agenten verfügbar.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {agents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      )}
    </div>
  )
}
