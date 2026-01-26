"use client"

import React from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Plus, Trash2, Clock, RefreshCw } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { de } from 'date-fns/locale'
import type { BreakSegment } from '@/types/main'

interface BreakSegmentEditorProps {
  breakSegments: BreakSegment[]
  onChange: (segments: BreakSegment[]) => void
  disabled?: boolean
  showRecalculateButton?: boolean
  onRecalculate?: () => void
  isCalculating?: boolean
  baseDate?: string // Datum für die Pausensegmente (YYYY-MM-DD)
}

/**
 * Editor für Pausensegmente
 * Zeigt berechnete Pausen an und ermöglicht manuelle Bearbeitung
 */
export function BreakSegmentEditor({
  breakSegments,
  onChange,
  disabled = false,
  showRecalculateButton = false,
  onRecalculate,
  isCalculating = false,
  baseDate
}: BreakSegmentEditorProps) {
  // Hilfsfunktion: Zeit aus ISO-String extrahieren
  const extractTime = (isoString: string): string => {
    if (!isoString) return ''
    if (isoString.includes('T')) {
      return isoString.split('T')[1]?.slice(0, 5) || ''
    }
    return isoString.slice(0, 5)
  }

  // Hilfsfunktion: Pausendauer in Minuten berechnen
  const calculateDuration = (segment: BreakSegment): number => {
    try {
      const start = new Date(segment.start)
      const end = new Date(segment.end)
      return Math.round((end.getTime() - start.getTime()) / (1000 * 60))
    } catch {
      return 0
    }
  }

  // Gesamtpausendauer berechnen
  const totalBreakMinutes = breakSegments.reduce(
    (sum, seg) => sum + calculateDuration(seg),
    0
  )

  // Pause hinzufügen
  const handleAddBreak = () => {
    const now = new Date()
    const dateStr = baseDate || format(now, 'yyyy-MM-dd')
    const newSegment: BreakSegment = {
      start: `${dateStr}T12:00`,
      end: `${dateStr}T12:30`
    }
    onChange([...breakSegments, newSegment])
  }

  // Pause entfernen
  const handleRemoveBreak = (index: number) => {
    const updated = breakSegments.filter((_, i) => i !== index)
    onChange(updated)
  }

  // Pause aktualisieren
  const handleUpdateBreak = (
    index: number,
    field: 'start' | 'end',
    value: string
  ) => {
    const updated = [...breakSegments]
    const segment = { ...updated[index] }
    
    // Datum beibehalten, nur Zeit ändern
    const existingDate = segment[field]?.slice(0, 10) || baseDate || format(new Date(), 'yyyy-MM-dd')
    segment[field] = `${existingDate}T${value}`
    
    updated[index] = segment
    onChange(updated)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Pausen
          <span className="text-xs font-normal text-slate-500">
            (Gesamt: {totalBreakMinutes} Min)
          </span>
        </Label>
        <div className="flex gap-2">
          {showRecalculateButton && onRecalculate && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRecalculate}
              disabled={isCalculating}
              className="rounded-lg text-xs"
            >
              <RefreshCw className={`h-3 w-3 mr-1 ${isCalculating ? 'animate-spin' : ''}`} />
              Neu berechnen
            </Button>
          )}
          {!disabled && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddBreak}
              className="rounded-lg text-xs"
            >
              <Plus className="h-3 w-3 mr-1" />
              Pause
            </Button>
          )}
        </div>
      </div>

      {breakSegments.length === 0 ? (
        <div className="text-sm text-slate-500 italic p-3 bg-slate-50 rounded-xl">
          Keine Pausen (Arbeitszeit unter 5 Stunden)
        </div>
      ) : (
        <div className="space-y-2">
          {breakSegments.map((segment, index) => {
            const duration = calculateDuration(segment)
            return (
              <div
                key={index}
                className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl"
              >
                <span className="text-sm font-medium text-slate-600 w-16">
                  Pause {index + 1}:
                </span>
                <div className="flex items-center gap-2">
                  <Input
                    type="time"
                    value={extractTime(segment.start)}
                    onChange={(e) => handleUpdateBreak(index, 'start', e.target.value)}
                    disabled={disabled}
                    className="w-24 h-8 text-sm rounded-lg"
                  />
                  <span className="text-slate-400">-</span>
                  <Input
                    type="time"
                    value={extractTime(segment.end)}
                    onChange={(e) => handleUpdateBreak(index, 'end', e.target.value)}
                    disabled={disabled}
                    className="w-24 h-8 text-sm rounded-lg"
                  />
                </div>
                <span className="text-xs text-slate-500 ml-2">
                  ({duration} Min)
                </span>
                {!disabled && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveBreak(index)}
                    className="h-8 w-8 ml-auto text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default BreakSegmentEditor
