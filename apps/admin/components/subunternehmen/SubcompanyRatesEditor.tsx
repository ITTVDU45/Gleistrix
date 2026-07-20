'use client'
import React from 'react'
import type { SubcompanyFunctionRate, SubcompanySurchargeRates } from '@/types/main'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, Trash2 } from 'lucide-react'

/** Basisfunktionen aus der Projektdisposition (frei ergänzbar) */
const BASE_FUNCTIONS = ['SIPO', 'HFE', 'Monteur/bediener', 'Sakra', 'BüP', 'HiBa', 'SAS', 'Bahnerder']

export interface RatesValue {
  functionRates: SubcompanyFunctionRate[]
  surchargeRates: SubcompanySurchargeRates
}

type Props = {
  value: RatesValue
  onChange: (value: RatesValue) => void
}

/**
 * Admin-Editor für die vereinbarten Stundensätze je Funktion sowie die
 * prozentualen Zuschläge. Die Sätze werden im Subunternehmen-Portal für die
 * automatische Rechnungsübernahme (Stunden × Satz) vorbelegt.
 */
export default function SubcompanyRatesEditor({ value, onChange }: Props) {
  const [customFunktion, setCustomFunktion] = React.useState('')

  const ratesByFunktion = new Map(
    value.functionRates.map((r) => [r.funktion.toLowerCase(), r])
  )
  const knownCustom = value.functionRates.filter(
    (r) => !BASE_FUNCTIONS.some((f) => f.toLowerCase() === r.funktion.toLowerCase())
  )
  const rows: Array<{ funktion: string; rate: number | undefined }> = [
    ...BASE_FUNCTIONS.map((funktion) => ({
      funktion,
      rate: ratesByFunktion.get(funktion.toLowerCase())?.hourlyRate,
    })),
    ...knownCustom.map((r) => ({ funktion: r.funktion, rate: r.hourlyRate })),
  ]

  const setRate = (funktion: string, raw: string) => {
    const nextRates = value.functionRates.filter(
      (r) => r.funktion.toLowerCase() !== funktion.toLowerCase()
    )
    if (raw !== '') {
      const parsed = Number(raw.replace(',', '.'))
      if (Number.isFinite(parsed) && parsed >= 0) {
        nextRates.push({ funktion, hourlyRate: parsed })
      }
    }
    onChange({ ...value, functionRates: nextRates })
  }

  const removeCustom = (funktion: string) => {
    onChange({
      ...value,
      functionRates: value.functionRates.filter(
        (r) => r.funktion.toLowerCase() !== funktion.toLowerCase()
      ),
    })
  }

  const addCustom = () => {
    const name = customFunktion.trim()
    if (!name) return
    if (ratesByFunktion.has(name.toLowerCase()) || BASE_FUNCTIONS.some((f) => f.toLowerCase() === name.toLowerCase())) {
      setCustomFunktion('')
      return
    }
    onChange({ ...value, functionRates: [...value.functionRates, { funktion: name, hourlyRate: 0 }] })
    setCustomFunktion('')
  }

  const setSurcharge = (key: keyof SubcompanySurchargeRates, raw: string) => {
    const parsed = raw === '' ? undefined : Number(raw.replace(',', '.'))
    onChange({
      ...value,
      surchargeRates: {
        ...value.surchargeRates,
        [key]: parsed !== undefined && Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined,
      },
    })
  }

  return (
    <div className="space-y-5">
      <div>
        <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          Stundensätze je Funktion (netto, €)
        </Label>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
          Diese Sätze werden im Portal automatisch als Einzelpreise der Rechnungspositionen
          vorgeschlagen (Stunden × Satz) und bleiben dort manuell änderbar.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {rows.map((row) => {
            const isCustom = !BASE_FUNCTIONS.includes(row.funktion)
            return (
              <div
                key={row.funktion}
                className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2"
              >
                <span className="flex-1 text-sm text-slate-800 dark:text-slate-200 truncate">
                  {row.funktion}
                </span>
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  value={row.rate ?? ''}
                  placeholder="–"
                  onChange={(e) => setRate(row.funktion, e.target.value)}
                  className="h-9 w-24 rounded-lg text-right"
                />
                <span className="text-xs text-slate-400">€/h</span>
                {isCustom && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeCustom(row.funktion)}
                    title="Funktion entfernen"
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                )}
              </div>
            )
          })}
        </div>
        <div className="flex gap-2 mt-2">
          <Input
            value={customFunktion}
            onChange={(e) => setCustomFunktion(e.target.value)}
            placeholder="Weitere Funktion…"
            className="h-9 rounded-lg"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addCustom()
              }
            }}
          />
          <Button type="button" variant="outline" onClick={addCustom} className="rounded-lg shrink-0">
            <Plus className="h-4 w-4 mr-1" />
            Hinzufügen
          </Button>
        </div>
      </div>

      <div>
        <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          Zuschläge (% auf den Stundensatz)
        </Label>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
          Optional – ohne Angabe wird für Zuschlagsstunden der volle Stundensatz vorgeschlagen.
        </p>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              ['nachtProzent', 'Nacht'],
              ['sonntagProzent', 'Sonntag'],
              ['feiertagProzent', 'Feiertag'],
            ] as Array<[keyof SubcompanySurchargeRates, string]>
          ).map(([key, label]) => (
            <div key={key} className="space-y-1">
              <span className="text-xs text-slate-600 dark:text-slate-400">{label}</span>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  step="1"
                  min={0}
                  value={value.surchargeRates[key] ?? ''}
                  placeholder="–"
                  onChange={(e) => setSurcharge(key, e.target.value)}
                  className="h-9 rounded-lg text-right"
                />
                <span className="text-xs text-slate-400">%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
