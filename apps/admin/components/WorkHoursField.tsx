"use client";
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/** Stunden im deutschen Format (8,50) */
export function formatHours(hours: number): string {
  return (Number.isFinite(hours) ? hours : 0).toFixed(2).replace('.', ',')
}

interface WorkHoursFieldProps {
  /** Automatisch berechnete Arbeitsstunden (Endzeit - Startzeit - Pause) */
  autoHours: number
  /** null = automatisch berechnet, sonst der manuell gesetzte Wert */
  manualHours: string | null
  onChange: (value: string | null) => void
  /** Eindeutige IDs, falls das Feld mehrfach auf einer Seite vorkommt */
  idPrefix?: string
}

export function WorkHoursField({
  autoHours,
  manualHours,
  onChange,
  idPrefix = 'arbeitsstunden'
}: WorkHoursFieldProps) {
  const isManual = manualHours !== null

  return (
    <div className="space-y-2">
      <Label htmlFor={`${idPrefix}-value`} className="text-sm font-semibold text-slate-700">
        Arbeitszeit (Stunden)
      </Label>
      <Input
        id={`${idPrefix}-value`}
        inputMode="decimal"
        value={isManual ? manualHours : formatHours(autoHours)}
        readOnly={!isManual}
        onChange={(e) => {
          const val = e.target.value
          // Nur Stundenwerte zulassen (max. 2 Vor- und 2 Nachkommastellen)
          if (val === '' || /^[0-9]{0,2}([.,][0-9]{0,2})?$/.test(val)) {
            onChange(val)
          }
        }}
        className={`rounded-xl h-12 ${
          isManual
            ? 'border-slate-200 focus:border-blue-500 focus:ring-blue-500'
            : 'bg-slate-100 text-slate-600 border-slate-200 cursor-default'
        }`}
      />
      <div className="flex items-center space-x-3">
        <Checkbox
          id={`${idPrefix}-manual`}
          checked={isManual}
          onCheckedChange={(checked) => onChange(checked ? formatHours(autoHours) : null)}
          className="rounded"
        />
        <Label htmlFor={`${idPrefix}-manual`} className="text-sm font-medium text-slate-700">
          Arbeitsstunden manuell anpassen
        </Label>
      </div>
      {isManual && (
        <p className="text-xs text-slate-500">
          Gilt nur für die normalen Arbeitsstunden. Nacht-, Sonntags- und Feiertagsstunden werden weiterhin automatisch aus Start- und Endzeit berechnet.
        </p>
      )}
    </div>
  )
}
