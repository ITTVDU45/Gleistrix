'use client'

import { format } from 'date-fns'
import { de } from 'date-fns/locale'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AlertTriangle, AlertCircle, X, User, Clock } from 'lucide-react'
import type { ConflictInfo } from './types'

interface ConflictPanelProps {
  conflicts: ConflictInfo[]
  isOpen: boolean
  onClose: () => void
}

export default function ConflictPanel({ conflicts, isOpen, onClose }: ConflictPanelProps) {
  if (!isOpen) return null

  const errorCount = conflicts.filter((c) => c.severity === 'error').length
  const warningCount = conflicts.filter((c) => c.severity === 'warning').length

  return (
    <div className="w-[85vw] sm:w-80 border-l border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex flex-col h-full shrink-0">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Konflikte
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            {conflicts.length === 0
              ? 'Keine Konflikte erkannt'
              : `${conflicts.length} Konflikt${conflicts.length > 1 ? 'e' : ''} gefunden`}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Badges */}
      {conflicts.length > 0 && (
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex gap-2">
          {errorCount > 0 && (
            <Badge variant="destructive" className="flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {errorCount} Fehler
            </Badge>
          )}
          {warningCount > 0 && (
            <Badge variant="secondary" className="flex items-center gap-1 bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300">
              <AlertTriangle className="h-3 w-3" />
              {warningCount} Warnungen
            </Badge>
          )}
        </div>
      )}

      {/* Liste */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {conflicts.length === 0 && (
          <div className="text-center py-8 text-slate-500 dark:text-slate-400">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Alles in Ordnung!</p>
          </div>
        )}

        {conflicts.map((conflict) => (
          <div
            key={conflict.id}
            className={`rounded-lg border p-3 space-y-2 ${
              conflict.severity === 'error'
                ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20'
                : 'border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20'
            }`}
          >
            <div className="flex items-center gap-2 text-sm font-medium">
              <User className="h-4 w-4 text-slate-500" />
              <span className="text-slate-900 dark:text-white">{conflict.mitarbeiterName}</span>
            </div>

            <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
              <p>
                {conflict.conflictType === 'double_booking' ? 'Doppelbuchung' : 'Arbeit während Abwesenheit'}
              </p>
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>
                  {format(new Date(conflict.overlapStart), 'dd.MM. HH:mm', { locale: de })} –{' '}
                  {format(new Date(conflict.overlapEnd), 'dd.MM. HH:mm', { locale: de })}
                </span>
              </div>
            </div>

            <div className="flex gap-1 text-[10px]">
              <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                {conflict.event1.title}
              </span>
              <span className="text-slate-400">↔</span>
              <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                {conflict.event2.title}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
