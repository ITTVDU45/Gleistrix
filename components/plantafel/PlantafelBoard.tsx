'use client'

import { useState, useMemo, useCallback, useRef } from 'react'
import { Calendar, dateFnsLocalizer, Views } from 'react-big-calendar'
import { format, parse, startOfWeek, getDay, addHours } from 'date-fns'
import { de } from 'date-fns/locale'
import 'react-big-calendar/lib/css/react-big-calendar.css'

import { usePlantafel } from '@/hooks/usePlantafel'
import { useEmployees } from '@/hooks/useEmployees'
import { useProjects } from '@/hooks/useProjects'

import PlantafelToolbar from './PlantafelToolbar'
import YearView from './YearView'
import AssignmentDialog from './AssignmentDialog'
import ConflictPanel from './ConflictPanel'
import ProjektSidebar from './ProjektSidebar'
import EventTooltip from './EventTooltip'
import { Button } from '@/components/ui/button'
import { AlertTriangle, PanelRightOpen, Plus, Palmtree, Landmark, Moon } from 'lucide-react'
import type { PlantafelEvent, PlantafelCalendarView, CreatePlantafelAssignmentRequest } from './types'

const locales = { de }
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales })

const VIEW_MAP: Record<PlantafelCalendarView, string> = {
  day: Views.DAY,
  week: Views.WEEK,
  month: Views.MONTH,
  year: Views.MONTH,
}

const EVENT_COLORS: Record<string, string> = {
  einsatz: '#3b82f6',
  meeting: '#14b8a6',
  urlaub: '#fb923c',
  krankheit: '#ef4444',
  sonderurlaub: '#a78bfa',
  unbezahlt: '#fbbf24',
  sonstiges: '#94a3b8',
  feiertag: '#f59e0b',
}

export default function PlantafelBoard() {
  const {
    view,
    setView,
    calendarView,
    setCalendarView,
    currentDate,
    setCurrentDate,
    filters,
    setFilters,
    events,
    resources,
    conflicts,
    isLoading,
    error,
    createAssignment,
    updateAssignment,
    deleteAssignment,
  } = usePlantafel()

  const { employees } = useEmployees()
  const { projects } = useProjects()

  const [searchTerm, setSearchTerm] = useState('')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [dialogEvent, setDialogEvent] = useState<PlantafelEvent | null>(null)
  const [dialogDefaults, setDialogDefaults] = useState<{ start?: Date; end?: Date; resourceId?: string; projektId?: string; mitarbeiterId?: string }>({})
  const [isConflictPanelOpen, setIsConflictPanelOpen] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const calendarRef = useRef<HTMLDivElement>(null)

  const filteredEvents = useMemo(() => {
    if (!searchTerm) return events
    const lower = searchTerm.toLowerCase()
    return events.filter(
      (e) =>
        e.title.toLowerCase().includes(lower) ||
        e.projektName?.toLowerCase().includes(lower) ||
        e.mitarbeiterName?.toLowerCase().includes(lower)
    )
  }, [events, searchTerm])

  const handleSelectEvent = useCallback((event: PlantafelEvent) => {
    if (event.sourceType === 'feiertag' || event.sourceType === 'urlaub') return
    setDialogEvent(event)
    setDialogDefaults({})
    setIsDialogOpen(true)
  }, [])

  const handleSelectSlot = useCallback(({ start, end }: { start: Date; end: Date }) => {
    setDialogEvent(null)
    setDialogDefaults({ start, end })
    setIsDialogOpen(true)
  }, [])

  const handleSave = useCallback(async (data: CreatePlantafelAssignmentRequest) => {
    await createAssignment(data)
  }, [createAssignment])

  const handleUpdate = useCallback(async (id: string, data: Partial<CreatePlantafelAssignmentRequest>) => {
    await updateAssignment(id, data)
  }, [updateAssignment])

  const handleDelete = useCallback(async (id: string) => {
    await deleteAssignment(id)
  }, [deleteAssignment])

  const handleYearDayClick = useCallback((date: Date) => {
    setCurrentDate(date)
    setCalendarView('week')
  }, [setCurrentDate, setCalendarView])

  const handleYearMonthClick = useCallback((date: Date) => {
    setCurrentDate(date)
    setCalendarView('month')
  }, [setCurrentDate, setCalendarView])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (calendarRef.current && !calendarRef.current.contains(e.relatedTarget as Node)) {
      setIsDragOver(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)

    const raw = e.dataTransfer.getData('application/json')
    if (!raw) return

    try {
      const data = JSON.parse(raw) as { type: string; id: string; name: string }
      const now = new Date()
      const dropStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), now.getHours(), 0)
      const dropEnd = addHours(dropStart, 8)

      const defaults: typeof dialogDefaults = {
        start: dropStart,
        end: dropEnd,
      }

      if (data.type === 'project') {
        defaults.projektId = data.id
      } else if (data.type === 'employee') {
        defaults.mitarbeiterId = data.id
      }

      setDialogEvent(null)
      setDialogDefaults(defaults)
      setIsDialogOpen(true)
    } catch { /* invalid data */ }
  }, [currentDate])

  const CustomEvent = useMemo(() => {
    const Comp = ({ event }: { event: PlantafelEvent }) => (
      <EventTooltip event={event}>
        <span className="block truncate text-xs leading-tight">{event.title}</span>
      </EventTooltip>
    )
    Comp.displayName = 'CustomEvent'
    return Comp
  }, [])

  const eventStyleGetter = useCallback((event: PlantafelEvent) => {
    const bgColor = event.color || EVENT_COLORS[event.type] || '#3b82f6'
    return {
      style: {
        backgroundColor: bgColor,
        borderRadius: '4px',
        border: event.hasConflict ? '2px solid #ef4444' : 'none',
        color: '#fff',
        fontSize: '0.75rem',
        padding: '2px 4px',
      },
    }
  }, [])

  const calendarMessages = useMemo(() => ({
    today: 'Heute',
    previous: 'Zurück',
    next: 'Weiter',
    month: 'Monat',
    week: 'Woche',
    day: 'Tag',
    agenda: 'Agenda',
    date: 'Datum',
    time: 'Uhrzeit',
    event: 'Ereignis',
    noEventsInRange: 'Keine Einträge in diesem Zeitraum.',
    showMore: (total: number) => `+${total} weitere`,
  }), [])

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-6">
        <p className="text-red-700 dark:text-red-400 font-medium">Fehler beim Laden der Plantafel</p>
        <p className="text-sm text-red-600 dark:text-red-500 mt-1">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-2">
        <PlantafelToolbar
          view={view}
          calendarView={calendarView}
          currentDate={currentDate}
          onViewChange={setView}
          onCalendarViewChange={setCalendarView}
          onNavigate={setCurrentDate}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
        />

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsSidebarOpen((v) => !v)}
          >
            <PanelRightOpen className="h-4 w-4 sm:mr-1" />
            <span className="hidden sm:inline">{view === 'team' ? 'Mitarbeiter' : 'Projekte'}</span>
          </Button>

          <div className="flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 p-0.5">
            <Button
              variant={filters.showAbsences ? 'default' : 'ghost'}
              size="sm"
              className="rounded-md"
              onClick={() => setFilters((f) => ({ ...f, showAbsences: !f.showAbsences }))}
              title="Urlaub & Krankmeldungen ein-/ausblenden"
            >
              <Palmtree className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Abwesenheiten</span>
            </Button>
            <Button
              variant={filters.showGermanHolidays ? 'default' : 'ghost'}
              size="sm"
              className="rounded-md"
              onClick={() => setFilters((f) => ({ ...f, showGermanHolidays: !f.showGermanHolidays }))}
              title="Deutsche Feiertage ein-/ausblenden"
            >
              <Landmark className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Feiertage DE</span>
            </Button>
            <Button
              variant={filters.showIslamicHolidays ? 'default' : 'ghost'}
              size="sm"
              className="rounded-md"
              onClick={() => setFilters((f) => ({ ...f, showIslamicHolidays: !f.showIslamicHolidays }))}
              title="Islamische Feiertage ein-/ausblenden"
            >
              <Moon className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Feiertage Islam.</span>
            </Button>
          </div>

          {conflicts.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsConflictPanelOpen((v) => !v)}
              className="text-orange-600 border-orange-300 hover:bg-orange-50 dark:text-orange-400 dark:border-orange-700 dark:hover:bg-orange-900/20"
            >
              <AlertTriangle className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">{conflicts.length} Konflikte</span>
              <span className="sm:hidden">{conflicts.length}</span>
            </Button>
          )}

          <Button size="sm" onClick={() => { setDialogEvent(null); setDialogDefaults({}); setIsDialogOpen(true) }}>
            <Plus className="h-4 w-4 sm:mr-1" />
            <span className="hidden sm:inline">Neuer Einsatz</span>
          </Button>
        </div>
      </div>

      {/* Hauptbereich */}
      <div
        ref={calendarRef}
        className={`relative rounded-lg border-2 transition-colors bg-white dark:bg-slate-800 ${
          isDragOver
            ? 'border-blue-400 bg-blue-50/50 dark:bg-blue-900/10'
            : 'border-slate-200 dark:border-slate-700'
        }`}
        style={{ height: '70vh' }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isDragOver && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-blue-50/60 dark:bg-blue-900/20 pointer-events-none rounded-lg">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg px-6 py-4 text-center">
              <p className="text-blue-600 dark:text-blue-400 font-semibold">Hier ablegen</p>
              <p className="text-xs text-slate-500 mt-1">Einsatz wird erstellt</p>
            </div>
          </div>
        )}
        {/* Kalender */}
        <div className="h-full p-2 sm:p-4 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center space-y-3">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto" />
                <p className="text-sm text-slate-500 dark:text-slate-400">Daten werden geladen...</p>
              </div>
            </div>
          ) : calendarView === 'year' ? (
            <YearView
              events={filteredEvents}
              year={currentDate}
              onDayClick={handleYearDayClick}
              onMonthClick={handleYearMonthClick}
            />
          ) : (
            <Calendar<PlantafelEvent>
              localizer={localizer}
              events={filteredEvents}
              startAccessor="start"
              endAccessor="end"
              titleAccessor="title"
              view={VIEW_MAP[calendarView] as 'day' | 'week' | 'month'}
              date={currentDate}
              onNavigate={setCurrentDate}
              onView={() => {}}
              onSelectEvent={handleSelectEvent}
              onSelectSlot={handleSelectSlot}
              selectable
              eventPropGetter={eventStyleGetter}
              components={{ event: CustomEvent }}
              messages={calendarMessages}
              culture="de"
              toolbar={false}
              style={{ height: '100%', minWidth: calendarView === 'week' ? '600px' : undefined }}
              step={30}
              timeslots={2}
            />
          )}
        </div>

        {/* Sidebars — Overlay auf Mobile, inline ab lg */}
        {isConflictPanelOpen && (
          <>
            <div className="fixed inset-0 bg-black/30 z-30 lg:hidden" onClick={() => setIsConflictPanelOpen(false)} />
            <div className="fixed right-0 top-0 bottom-0 z-40 lg:absolute lg:top-0 lg:bottom-0 lg:right-0 lg:z-10">
              <ConflictPanel
                conflicts={conflicts}
                isOpen={isConflictPanelOpen}
                onClose={() => setIsConflictPanelOpen(false)}
              />
            </div>
          </>
        )}

        {isSidebarOpen && (
          <>
            <div className="fixed inset-0 bg-black/30 z-30 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
            <div className="fixed right-0 top-0 bottom-0 z-40 lg:absolute lg:top-0 lg:bottom-0 lg:right-0 lg:z-10">
              <ProjektSidebar
                employees={employees}
                projects={projects}
                view={view}
                isOpen={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
              />
            </div>
          </>
        )}
      </div>

      {/* Assignment Dialog */}
      <AssignmentDialog
        open={isDialogOpen}
        onClose={() => { setIsDialogOpen(false); setDialogEvent(null) }}
        event={dialogEvent}
        employees={employees}
        projects={projects}
        onSave={handleSave}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        defaultStart={dialogDefaults.start}
        defaultEnd={dialogDefaults.end}
        defaultResourceId={dialogDefaults.resourceId}
        defaultProjektId={dialogDefaults.projektId}
        defaultMitarbeiterId={dialogDefaults.mitarbeiterId}
      />
    </div>
  )
}
