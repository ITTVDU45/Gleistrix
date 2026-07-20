'use client'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { FolderKanban, SlidersHorizontal } from 'lucide-react'
import type { PlantafelFilters } from './types'

const PROJECT_STATUSES: { value: string; label: string }[] = [
  { value: 'aktiv', label: 'Aktiv' },
  { value: 'abgeschlossen', label: 'Abgeschlossen' },
  { value: 'fertiggestellt', label: 'Fertiggestellt' },
  { value: 'geleistet', label: 'Geleistet' },
  { value: 'teilweise_abgerechnet', label: 'Teilweise abgerechnet' },
  { value: 'kein Status', label: 'Kein Status' },
]

interface ProjectFilterControlProps {
  filters: PlantafelFilters
  setFilters: (updater: (f: PlantafelFilters) => PlantafelFilters) => void
}

export default function ProjectFilterControl({ filters, setFilters }: ProjectFilterControlProps) {
  const toggleShowProjects = () => {
    setFilters((f) => ({ ...f, showProjects: !f.showProjects }))
  }

  const toggleStatus = (status: string, visible: boolean) => {
    setFilters((f) => {
      const hidden = new Set(f.hiddenProjectStatuses)
      if (visible) hidden.delete(status)
      else hidden.add(status)
      return { ...f, hiddenProjectStatuses: Array.from(hidden) }
    })
  }

  const hiddenCount = filters.hiddenProjectStatuses.length

  return (
    <div className="flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 p-0.5">
      <Button
        variant={filters.showProjects ? 'default' : 'ghost'}
        size="sm"
        className="rounded-md"
        onClick={toggleShowProjects}
        title="Projekte (Laufzeit & erfasste Tage) ein-/ausblenden"
      >
        <FolderKanban className="h-4 w-4 sm:mr-1" />
        <span className="hidden sm:inline">Projekte</span>
      </Button>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="rounded-md"
            disabled={!filters.showProjects}
            title="Nach Projektstatus filtern"
          >
            <SlidersHorizontal className="h-4 w-4" />
            {hiddenCount > 0 && (
              <span className="ml-1 text-xs font-medium text-amber-600 dark:text-amber-400">{hiddenCount}</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-56 p-3">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-2">
            Sichtbare Projektstatus
          </p>
          <div className="space-y-2">
            {PROJECT_STATUSES.map((s) => {
              const visible = !filters.hiddenProjectStatuses.includes(s.value)
              return (
                <label key={s.value} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={visible}
                    onCheckedChange={(c) => toggleStatus(s.value, c === true)}
                  />
                  <span className="text-sm text-slate-700 dark:text-slate-300">{s.label}</span>
                </label>
              )
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
