'use client'

import { Plus } from 'lucide-react'

interface NewProjectCardProps {
  onClick: () => void
}

export default function NewProjectCard({ onClick }: NewProjectCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-800/50 hover:border-blue-400 hover:bg-blue-50/50 dark:hover:border-blue-600 dark:hover:bg-blue-900/10 transition-colors min-h-[16rem] p-6 text-center"
    >
      <div className="p-3 rounded-full bg-slate-100 dark:bg-slate-700">
        <Plus className="h-6 w-6 text-slate-500 dark:text-slate-400" />
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          Informationen befüllen
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Neues Projekt für diesen Tag anlegen — es erscheint anschließend auch in der Projektliste.
        </p>
      </div>
    </button>
  )
}
