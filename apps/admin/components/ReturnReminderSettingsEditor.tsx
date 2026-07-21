'use client'

import React, { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Plus, Trash2 } from 'lucide-react'
import type { ReturnReminderConfig, ReturnReminderUnit } from '@/lib/notificationDefs'
import {
  normalizeReturnReminderConfig,
  returnReminderIntervalLabel,
} from '@/lib/lager/returnReminderSchedule'

interface ReturnReminderSettingsEditorProps {
  value: unknown
  onChange: (config: ReturnReminderConfig) => Promise<void>
}

const unitLabels: Record<ReturnReminderUnit, string> = {
  days: 'Tage',
  weeks: 'Wochen',
  months: 'Monate',
}

export default function ReturnReminderSettingsEditor({
  value,
  onChange,
}: ReturnReminderSettingsEditorProps) {
  const config = useMemo(() => normalizeReturnReminderConfig(value), [value])
  const [customValue, setCustomValue] = useState('')
  const [customUnit, setCustomUnit] = useState<ReturnReminderUnit>('days')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  async function save(next: ReturnReminderConfig) {
    setIsSaving(true)
    setError('')
    try {
      await onChange(next)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Zeitpunkte konnten nicht gespeichert werden.')
    } finally {
      setIsSaving(false)
    }
  }

  async function addInterval() {
    const numericValue = Number(customValue)
    if (!Number.isInteger(numericValue) || numericValue < 0) {
      setError('Bitte eine ganze Zahl ab 0 eingeben.')
      return
    }
    if (config.intervals.some((interval) => interval.value === numericValue && interval.unit === customUnit)) {
      setError('Dieser Erinnerungszeitpunkt ist bereits vorhanden.')
      return
    }
    await save({
      intervals: [
        ...config.intervals,
        {
          id: `custom-${customUnit}-${numericValue}-${Date.now()}`,
          value: numericValue,
          unit: customUnit,
          enabled: true,
        },
      ],
    })
    setCustomValue('')
  }

  return (
    <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-900/30">
      <div className="space-y-2">
        {config.intervals.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">Noch keine Erinnerungszeitpunkte angelegt.</p>
        ) : (
          config.intervals.map((interval) => (
            <div
              key={interval.id}
              className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
            >
              <Switch
                checked={interval.enabled}
                disabled={isSaving}
                aria-label={`${returnReminderIntervalLabel(interval)} ein- oder ausschalten`}
                onCheckedChange={(enabled) => save({
                  intervals: config.intervals.map((row) =>
                    row.id === interval.id ? { ...row, enabled } : row
                  ),
                })}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                  {returnReminderIntervalLabel(interval)}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {interval.enabled ? 'E-Mail und interne Benachrichtigung aktiv' : 'Deaktiviert'}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 w-9 p-0 text-slate-500 hover:text-red-600"
                disabled={isSaving}
                aria-label={`${returnReminderIntervalLabel(interval)} löschen`}
                onClick={() => save({
                  intervals: config.intervals.filter((row) => row.id !== interval.id),
                })}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))
        )}
      </div>

      <div className="mt-4 border-t border-slate-200 pt-3 dark:border-slate-700">
        <Label className="mb-2 block text-xs">Weiteren Zeitpunkt hinzufügen</Label>
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(110px,1fr)_44px] gap-2">
          <Input
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            value={customValue}
            disabled={isSaving}
            placeholder="z. B. 10"
            aria-label="Anzahl"
            onChange={(event) => setCustomValue(event.target.value)}
          />
          <Select
            value={customUnit}
            disabled={isSaving}
            onValueChange={(unit) => setCustomUnit(unit as ReturnReminderUnit)}
          >
            <SelectTrigger aria-label="Zeiteinheit">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.entries(unitLabels) as Array<[ReturnReminderUnit, string]>).map(([unit, label]) => (
                <SelectItem key={unit} value={unit}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            size="icon"
            disabled={isSaving || customValue === ''}
            aria-label="Erinnerungszeitpunkt hinzufügen"
            onClick={addInterval}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
      </div>
    </div>
  )
}
