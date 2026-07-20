'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Check, Sparkles, MessageSquareQuote, Hammer } from 'lucide-react'
import type { Agent } from '@/types/agents'

interface AgentPlaceholderViewProps {
  agent: Agent
}

/**
 * Generische Platzhalter-Ansicht für Agenten, deren Detail-Implementierung noch
 * aussteht. Rein datengetrieben aus dem `Agent`-Objekt (Beschreibung, Nutzen,
 * Mehrwert, Beispiele) – dadurch für jeden neuen Agenten sofort wiederverwendbar.
 */
export default function AgentPlaceholderView({ agent }: AgentPlaceholderViewProps) {
  return (
    <div className="space-y-5">
      <Card className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <CardContent className="p-6">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 ring-1 ring-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:ring-blue-800">
            <Hammer className="h-3.5 w-3.5" />
            In Vorbereitung – Implementierung folgt
          </div>

          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Über diesen Agenten</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            {agent.description}
          </p>

          {agent.nutzen && agent.nutzen.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Nutzen im System</h3>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {agent.nutzen.map((punkt, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200">
                    <span className="mt-0.5 rounded-md bg-emerald-50 p-0.5 text-emerald-600 ring-1 ring-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 dark:ring-emerald-800">
                      <Check className="h-3.5 w-3.5" />
                    </span>
                    {punkt}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {agent.beispiele && agent.beispiele.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Beispiel-Anfragen</h3>
              <ul className="mt-3 space-y-2">
                {agent.beispiele.map((bsp, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:bg-slate-700/40 dark:text-slate-300"
                  >
                    <MessageSquareQuote className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                    „{bsp}"
                  </li>
                ))}
              </ul>
            </div>
          )}

          {agent.mehrwert && (
            <div className="mt-6 flex items-start gap-3 rounded-xl bg-blue-50 p-4 dark:bg-blue-900/20">
              <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">
                  Mehrwert
                </p>
                <p className="mt-0.5 text-sm text-slate-700 dark:text-slate-200">{agent.mehrwert}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
