'use client'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { MapPin } from 'lucide-react'
import { GERMAN_STATES } from '@/lib/holidays'
import { toggleHolidayState } from '@/lib/plantafel/holidayStateSelection'
import type { PlantafelFilters } from './types'

const ALL_STATE_CODES = GERMAN_STATES.map((s) => s.code)

interface HolidayStateFilterControlProps {
  filters: PlantafelFilters
  setFilters: (updater: (f: PlantafelFilters) => PlantafelFilters) => void
}

/**
 * Bundesland-Filter für die angezeigten Feiertage.
 *
 * Standard ist "alle Bundesländer" (leere Auswahl), damit bundesweit tätige
 * Teams alle regionalen Feiertage auf einen Blick sehen. Wird das letzte Land
 * abgewählt, schaltet der Filter die deutschen Feiertage ganz ab
 * (siehe toggleHolidayState).
 */
export default function HolidayStateFilterControl({
  filters,
  setFilters,
}: HolidayStateFilterControlProps) {
  const selected = filters.holidayStates
  // Ohne aktive deutsche Feiertage gilt die leere Liste als "keines", nicht "alle".
  const holidaysOff = !filters.showGermanHolidays
  const isAllSelected = !holidaysOff && selected.length === 0

  const toggleState = (code: string, checked: boolean) => {
    setFilters((f) => ({ ...f, ...toggleHolidayState(f, ALL_STATE_CODES, code, checked) }))
  }

  const selectAll = () =>
    setFilters((f) => ({ ...f, holidayStates: [], showGermanHolidays: true }))

  const label = holidaysOff
    ? 'Keine Feiertage'
    : isAllSelected
      ? 'Alle Bundesländer'
      : selected.length === 1
        ? GERMAN_STATES.find((s) => s.code === selected[0])?.name ?? selected[0]
        : `${selected.length} Bundesländer`

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" title="Feiertage nach Bundesland filtern">
          <MapPin className="h-4 w-4 sm:mr-1" />
          <span className="hidden sm:inline">Bundesland</span>
          {!isAllSelected && (
            <span className="ml-1 text-xs font-medium text-amber-600 dark:text-amber-400">
              {holidaysOff ? 0 : selected.length}
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
                checked={isAllSelected || (!holidaysOff && selected.includes(state.code))}
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
