'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Users,
  Building2,
  Search,
} from 'lucide-react'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'
import type { PlantafelView, PlantafelCalendarView } from './types'

interface PlantafelToolbarProps {
  view: PlantafelView
  calendarView: PlantafelCalendarView
  currentDate: Date
  onViewChange: (view: PlantafelView) => void
  onCalendarViewChange: (view: PlantafelCalendarView) => void
  onNavigate: (date: Date) => void
  searchTerm: string
  onSearchChange: (term: string) => void
}

const CALENDAR_VIEWS: { value: PlantafelCalendarView; label: string }[] = [
  { value: 'day', label: 'Tag' },
  { value: 'week', label: 'Woche' },
  { value: 'month', label: 'Monat' },
  { value: 'year', label: 'Jahr' },
]

function getNavigationLabel(date: Date, calendarView: PlantafelCalendarView): string {
  switch (calendarView) {
    case 'day':
      return format(date, 'EEEE, dd. MMMM yyyy', { locale: de })
    case 'week': {
      const weekStart = new Date(date)
      weekStart.setDate(date.getDate() - date.getDay() + 1)
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekStart.getDate() + 6)
      return `${format(weekStart, 'dd. MMM', { locale: de })} – ${format(weekEnd, 'dd. MMM yyyy', { locale: de })}`
    }
    case 'month':
      return format(date, 'MMMM yyyy', { locale: de })
    case 'year':
      return format(date, 'yyyy')
  }
}

function navigateDate(date: Date, calendarView: PlantafelCalendarView, direction: -1 | 1): Date {
  const next = new Date(date)
  switch (calendarView) {
    case 'day':
      next.setDate(next.getDate() + direction)
      break
    case 'week':
      next.setDate(next.getDate() + direction * 7)
      break
    case 'month':
      next.setMonth(next.getMonth() + direction)
      break
    case 'year':
      next.setFullYear(next.getFullYear() + direction)
      break
  }
  return next
}

export default function PlantafelToolbar({
  view,
  calendarView,
  currentDate,
  onViewChange,
  onCalendarViewChange,
  onNavigate,
  searchTerm,
  onSearchChange,
}: PlantafelToolbarProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      {/* Linke Seite: View-Switcher + Navigation */}
      <div className="flex items-center gap-2">
        {/* Team / Projekt View */}
        <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
          <Button
            variant={view === 'team' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onViewChange('team')}
            className="rounded-none"
          >
            <Users className="h-4 w-4 mr-1" />
            Team
          </Button>
          <Button
            variant={view === 'project' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onViewChange('project')}
            className="rounded-none"
          >
            <Building2 className="h-4 w-4 mr-1" />
            Projekt
          </Button>
        </div>

        {/* Datum-Navigation */}
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigate(navigateDate(currentDate, calendarView, -1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigate(new Date())}
          >
            <Calendar className="h-4 w-4 mr-1" />
            Heute
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigate(navigateDate(currentDate, calendarView, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <span className="text-sm font-medium text-slate-700 dark:text-slate-300 min-w-[180px]">
          {getNavigationLabel(currentDate, calendarView)}
        </span>
      </div>

      {/* Rechte Seite: Kalender-View + Suche */}
      <div className="flex items-center gap-2">
        <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
          {CALENDAR_VIEWS.map((cv) => (
            <Button
              key={cv.value}
              variant={calendarView === cv.value ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onCalendarViewChange(cv.value)}
              className="rounded-none text-xs px-3"
            >
              {cv.label}
            </Button>
          ))}
        </div>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Suchen..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-8 h-8 w-[180px] text-sm"
          />
        </div>
      </div>
    </div>
  )
}
