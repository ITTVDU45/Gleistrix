'use client'

import type { LucideIcon } from 'lucide-react'

interface ChoiceCardProps {
  icon: LucideIcon
  title: string
  description: string
  onClick: () => void
}

/** Große Auswahlkachel für die Entscheidungsschritte des Einsatz-Assistenten. */
export default function ChoiceCard({ icon: Icon, title, description, onClick }: ChoiceCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-start gap-3 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-800/50 hover:border-blue-400 hover:bg-blue-50/50 dark:hover:border-blue-600 dark:hover:bg-blue-900/10 transition-colors p-5 text-left"
    >
      <div className="p-3 rounded-full bg-slate-100 dark:bg-slate-700">
        <Icon className="h-6 w-6 text-slate-500 dark:text-slate-400" />
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{description}</p>
      </div>
    </button>
  )
}
