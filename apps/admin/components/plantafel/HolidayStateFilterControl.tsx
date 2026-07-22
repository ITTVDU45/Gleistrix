'use client'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { MapPin } from 'lucide-react'
import { GERMAN_STATES } from '@/lib/holidays'
import type { PlantafelFilters } from './types'

interface HolidayStateFilterControlProps {
  filters: PlantafelFilters
  setFilters: (updater: (f: PlantafelFilters) => PlantafelFilters) => void
}

/**
 * Bundesland-Filter für die angezeigten Feiertage.
 *
 * Standard ist "alle Bundesländer" (leere Auswahl), damit bundesweit tätige
 * Teams alle regionalen Feiertage auf einen Blick sehen.
 */
export default function HolidayStateFilterControl({
  filters,
  setFilters,
}: HolidayStateFilterControlProps) {
  const selected = filters.holidayStates
  const isAllSelected = selected.length === 0

  const toggleState = (code: string, checked: boolean) => {
    setFilters((f) => {
      const allCodes = GERMAN_STATES.map((s) => s.code)
      // Leere Auswahl steht für "alle" – zum Abwählen muss sie erst explizit
      // gemacht werden, sonst liefe das Entfernen ins Leere.
      const next = new Set<string>(f.holidayStates.length === 0 ? allCodes : f.holidayStates)
      if (checked) next.add(code)
      else next.delete(code)

      // Vollständige bzw. leere Auswahl auf den Standardzustand normalisieren.
      const codes = allCodes.filter((c) => next.has(c))
      const isAll = codes.length === allCodes.length || codes.length === 0
      return { ...f, holidayStates: isAll ? [] : codes }
    })
  }

  const selectAll = () => setFilters((f) => ({ ...f, holidayStates: [] }))

  const label = isAllSelected
    ? 'Alle Bundesländer'
    : selected.length === 1
      ? GERMAN_STATES.find((s) => s.code === selected[0])?.name ?? selected[0]
      : `${selected.length} Bundesländer`

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={!filters.showGermanHolidays}
          title="Feiertage nach Bundesland filtern"
        >
          <MapPin className="h-4 w-4 sm:mr-1" />
          <span className="hidden sm:inline">Bundesland</span>
          {!isAllSelected && (
            <span className="ml-1 text-xs font-medium text-amber-600 dark:text-amber-400">
              {selected.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
            Feiertage anzeigen für
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={selectAll}
            disabled={isAllSelected}
          >
            Alle
          </Button>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">{label}</p>

        <div className="grid grid-cols-2 gap-x-3 gap-y-2 max-h-72 overflow-y-auto">
          {GERMAN_STATES.map((state) => (
            <label key={state.code} className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={isAllSelected || selected.includes(state.code)}
                onCheckedChange={(c) => toggleState(state.code, c === true)}
              />
              <span className="text-sm text-slate-700 dark:text-slate-300 truncate" title={state.name}>
                {state.name}
              </span>
            </label>
          ))}
        </div>

        <label className="flex items-start gap-2 cursor-pointer mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
          <Checkbox
            checked={filters.showPartialHolidays}
            onCheckedChange={(c) =>
              setFilters((f) => ({ ...f, showPartialHolidays: c === true }))
            }
          />
          <span className="text-sm text-slate-700 dark:text-slate-300">
            Teilregionale Feiertage
            <span className="block text-xs text-slate-500 dark:text-slate-400">
              z. B. Fronleichnam in Sachsen, Mariä Himmelfahrt in Bayern
            </span>
          </span>
        </label>
      </PopoverContent>
    </Popover>
  )
}
