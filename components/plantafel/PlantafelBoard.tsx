'use client'

import { useState, useMemo, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Calendar, dateFnsLocalizer, Views } from 'react-big-calendar'
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop'
import { format, parse, startOfWeek, getDay, addHours, getISOWeek } from 'date-fns'
import { de } from 'date-fns/locale'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css'

import { usePlantafel } from '@/hooks/usePlantafel'
import { useEmployees } from '@/hooks/useEmployees'
import { useProjects } from '@/hooks/useProjects'

import PlantafelToolbar from './PlantafelToolbar'
import YearView from './YearView'
import DayView from './DayView'
import ProjectDayEditDialog, { type ProjectEditorTab } from './ProjectDayEditDialog'
import DocumentDropUploadDialog from './DocumentDropUploadDialog'
import ConflictPanel from './ConflictPanel'
import ProjektSidebar, { type SidebarDragItem } from './ProjektSidebar'
import ProjectFilterControl from './ProjectFilterControl'
import PlantafelLegend from './PlantafelLegend'
import EventTooltip from './EventTooltip'
import { SHIFT_DAY_COLOR, SHIFT_NIGHT_COLOR } from '@/lib/plantafel/projectColors'
import ProjectCreateWithGaeb from '@/components/ProjectCreateWithGaeb'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { AlertTriangle, PanelRightOpen, Plus, Palmtree, Landmark, Moon, FolderPlus, Upload } from 'lucide-react'
import type { PlantafelEvent, PlantafelCalendarView, PlantafelDayProject } from './types'

const locales = { de }
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales })

const DnDCalendar = withDragAndDrop<PlantafelEvent>(Calendar as never)

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
  projekt_plan: '#6366f1',
  projekt_ist: '#10b981',
}

interface DragItem {
  type: 'project' | 'employee'
  id: string
  name: string
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
  const { projects, fetchProjects } = useProjects()
  const router = useRouter()

  const [searchTerm, setSearchTerm] = useState('')

  // Zentraler Projekt-/Einsatz-Editor (vereinheitlichtes Popup)
  interface EditorState {
    open: boolean
    projectId: string | null
    projectName?: string
    initialTab: ProjectEditorTab
    einsatz: PlantafelEvent | null
    einsatzDefaults?: { start?: Date; end?: Date; mitarbeiterId?: string }
    dateKey: string
  }
  const [editor, setEditor] = useState<EditorState>({
    open: false,
    projectId: null,
    initialTab: 'einsatz',
    einsatz: null,
    dateKey: format(new Date(), 'yyyy-MM-dd'),
  })

  const [isConflictPanelOpen, setIsConflictPanelOpen] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isProjectDialogOpen, setIsProjectDialogOpen] = useState(false)
  const [dayRefreshKey, setDayRefreshKey] = useState(0)

  // Datei-Upload per Drag&Drop auf Projektkarte/-balken (2-seitiges Popup)
  const [docUpload, setDocUpload] = useState<{ projectId: string; projectName?: string; files: File[] } | null>(null)

  const externalDragRef = useRef<DragItem | null>(null)

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
    if (event.sourceType === 'projekt') {
      if (event.projektId) {
        setEditor({
          open: true,
          projectId: event.projektId,
          projectName: event.projektName,
          initialTab: 'zeiten',
          einsatz: null,
          dateKey: format(currentDate, 'yyyy-MM-dd'),
        })
      }
      return
    }
    // Einsatz-Event → Einsatz-Tab mit Daten
    setEditor({
      open: true,
      projectId: event.projektId || null,
      projectName: event.projektName,
      initialTab: 'einsatz',
      einsatz: event,
      dateKey: format(new Date(event.start), 'yyyy-MM-dd'),
    })
  }, [currentDate])

  const handleSelectSlot = useCallback(({ start, end }: { start: Date; end: Date }) => {
    setEditor({
      open: true,
      projectId: null,
      initialTab: 'einsatz',
      einsatz: null,
      einsatzDefaults: { start, end },
      dateKey: format(start, 'yyyy-MM-dd'),
    })
  }, [])

  const handleYearDayClick = useCallback((date: Date) => {
    setCurrentDate(date)
    setCalendarView('week')
  }, [setCurrentDate, setCalendarView])

  const handleYearMonthClick = useCallback((date: Date) => {
    setCurrentDate(date)
    setCalendarView('month')
  }, [setCurrentDate, setCalendarView])

  const handleOpenDetail = useCallback((projectId: string) => {
    router.push(`/projektdetail/${projectId}`)
  }, [router])

  const handleDayProjectClick = useCallback((project: PlantafelDayProject) => {
    setEditor({
      open: true,
      projectId: project.id,
      projectName: project.name,
      initialTab: 'zeiten',
      einsatz: null,
      dateKey: format(currentDate, 'yyyy-MM-dd'),
    })
  }, [currentDate])

  // Datei auf Projektkarte (Tag) gedroppt → Upload-Popup öffnen
  const handleDayProjectFileDrop = useCallback((project: PlantafelDayProject, files: File[]) => {
    setDocUpload({ projectId: project.id, projectName: project.name, files })
  }, [])

  // Datei auf Projekt-Balken (Woche) gedroppt → Upload-Popup öffnen
  const handleEventFileDrop = useCallback((event: PlantafelEvent, files: File[]) => {
    if (!event.projektId) return
    setDocUpload({ projectId: event.projektId, projectName: event.projektName || event.title, files })
  }, [])

  // Nach erfolgreichem Upload → Editor auf Dokumente-Tab öffnen
  const handleDocUploaded = useCallback(
    (target: { projectId: string; projectName?: string }) => {
      setEditor({
        open: true,
        projectId: target.projectId,
        projectName: target.projectName,
        initialTab: 'dokumente',
        einsatz: null,
        dateKey: format(currentDate, 'yyyy-MM-dd'),
      })
      setDocUpload(null)
      fetchProjects()
      setDayRefreshKey((k) => k + 1)
    },
    [currentDate, fetchProjects]
  )

  const handleEditorClose = useCallback(() => {
    setEditor((prev) => ({ ...prev, open: false, einsatz: null, einsatzDefaults: undefined }))
  }, [])

  const handleEditorSaved = useCallback(() => {
    fetchProjects()
    setDayRefreshKey((k) => k + 1)
  }, [fetchProjects])

  const handleOpenProjectDialog = useCallback(() => {
    setIsProjectDialogOpen(true)
  }, [])

  const handleProjectCreated = useCallback(() => {
    setIsProjectDialogOpen(false)
    setDayRefreshKey((k) => k + 1)
    fetchProjects()
  }, [fetchProjects])

  const handleDropFromOutside = useCallback(
    ({ start, end }: { start: string | Date; end: string | Date; allDay?: boolean }) => {
      const dragItem = externalDragRef.current
      if (!dragItem) return

      const startDate = new Date(start)
      const endDate = new Date(end)
      const dropEnd = endDate > startDate ? endDate : addHours(startDate, 8)

      setEditor({
        open: true,
        projectId: dragItem.type === 'project' ? dragItem.id : null,
        projectName: dragItem.type === 'project' ? dragItem.name : undefined,
        initialTab: 'einsatz',
        einsatz: null,
        einsatzDefaults: {
          start: startDate,
          end: dropEnd,
          mitarbeiterId: dragItem.type === 'employee' ? dragItem.id : undefined,
        },
        dateKey: format(startDate, 'yyyy-MM-dd'),
      })
      externalDragRef.current = null
    },
    []
  )

  const handleEventDrop = useCallback(
    async ({ event, start, end }: { event: PlantafelEvent; start: string | Date; end: string | Date }) => {
      if (event.sourceType !== 'einsatz') return
      await updateAssignment(event.sourceId, {
        von: new Date(start).toISOString(),
        bis: new Date(end).toISOString(),
      })
    },
    [updateAssignment]
  )

  const handleEventResize = useCallback(
    async ({ event, start, end }: { event: PlantafelEvent; start: string | Date; end: string | Date }) => {
      if (event.sourceType !== 'einsatz') return
      await updateAssignment(event.sourceId, {
        von: new Date(start).toISOString(),
        bis: new Date(end).toISOString(),
      })
    },
    [updateAssignment]
  )

  const dragFromOutsideItem = useCallback(() => {
    return externalDragRef.current as unknown as PlantafelEvent
  }, [])

  const handleSidebarDragStart = useCallback((item: SidebarDragItem) => {
    externalDragRef.current = item
  }, [])

  const handleSidebarDragEnd = useCallback(() => {
    externalDragRef.current = null
  }, [])

  const CustomEvent = useMemo(() => {
    const Comp = ({ event }: { event: PlantafelEvent }) => {
      const counts = event.shiftCounts
      const isProjekt = event.sourceType === 'projekt'
      const canDropFiles = Boolean(event.projektId)
      const [fileOver, setFileOver] = useState(false)
      return (
        <EventTooltip event={event}>
          <span
            className={`flex h-full w-full items-center gap-1 rounded leading-tight transition-shadow ${
              fileOver ? 'ring-2 ring-blue-500 ring-inset bg-blue-500/20' : ''
            }`}
            onDragOver={(e) => {
              if (!canDropFiles || !Array.from(e.dataTransfer?.types || []).includes('Files')) return
              e.preventDefault()
              e.stopPropagation()
              if (!fileOver) setFileOver(true)
            }}
            onDragLeave={(e) => {
              if (!canDropFiles) return
              e.preventDefault()
              e.stopPropagation()
              setFileOver(false)
            }}
            onDrop={(e) => {
              if (!canDropFiles || !Array.from(e.dataTransfer?.types || []).includes('Files')) return
              e.preventDefault()
              e.stopPropagation()
              setFileOver(false)
              const files = Array.from(e.dataTransfer.files || [])
              if (files.length) handleEventFileDrop(event, files)
            }}
          >
            {fileOver ? (
              <span className="flex w-full items-center justify-center gap-1 text-[11px] font-semibold">
                <Upload className="h-3.5 w-3.5" /> Ablegen
              </span>
            ) : (
            <span className="truncate text-xs">{event.title}</span>
            )}
            {!fileOver && isProjekt && counts && counts.tag > 0 && (
              <span
                className="shrink-0 rounded px-1 text-[9px] font-semibold leading-tight text-white"
                style={{ backgroundColor: SHIFT_DAY_COLOR }}
                title={`${counts.tag}× Frühschicht (04–22 Uhr)`}
              >
                {counts.tag}× Früh
              </span>
            )}
            {!fileOver && isProjekt && counts && counts.nacht > 0 && (
              <span
                className="shrink-0 rounded px-1 text-[9px] font-semibold leading-tight text-white"
                style={{ backgroundColor: SHIFT_NIGHT_COLOR }}
                title={`${counts.nacht}× Nachtschicht`}
              >
                {counts.nacht}× Nacht
              </span>
            )}
          </span>
        </EventTooltip>
      )
    }
    Comp.displayName = 'CustomEvent'
    return Comp
  }, [handleEventFileDrop])

  // KW-Anzeige im Wochen-Grid (Ecke oben links über der Zeitspalte)
  const WeekKwHeader = useMemo(() => {
    const Comp = () => (
      <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
        KW {getISOWeek(currentDate)}
      </span>
    )
    Comp.displayName = 'WeekKwHeader'
    return Comp
  }, [currentDate])

  // KW-Badge am Zeilenanfang (Montag) in der Monatsansicht
  const MonthDateHeader = useMemo(() => {
    const Comp = ({ date, label }: { date: Date; label: string }) => (
      <div className="flex items-center justify-between gap-1">
        {getDay(date) === 1 && (
          <span className="rounded bg-slate-100 px-1 text-[9px] font-semibold text-slate-500 dark:bg-slate-700 dark:text-slate-300">
            KW {getISOWeek(date)}
          </span>
        )}
        <span>{label}</span>
      </div>
    )
    Comp.displayName = 'MonthDateHeader'
    return Comp
  }, [])

  const calendarComponents = useMemo(
    () => ({
      event: CustomEvent,
      timeGutterHeader: WeekKwHeader,
      month: { dateHeader: MonthDateHeader },
    }),
    [CustomEvent, WeekKwHeader, MonthDateHeader]
  )

  const eventStyleGetter = useCallback((event: PlantafelEvent) => {
    const bgColor = event.color || EVENT_COLORS[event.type] || '#3b82f6'
    const isDraggable = event.sourceType === 'einsatz'
    const isPlanned = event.type === 'projekt_plan'
    return {
      style: {
        backgroundColor: isPlanned ? 'transparent' : bgColor,
        backgroundImage: isPlanned
          ? `repeating-linear-gradient(45deg, ${bgColor}33, ${bgColor}33 6px, ${bgColor}1a 6px, ${bgColor}1a 12px)`
          : undefined,
        borderRadius: '4px',
        border: event.hasConflict
          ? '2px solid #ef4444'
          : isPlanned
          ? `1px dashed ${bgColor}`
          : 'none',
        color: isPlanned ? bgColor : '#fff',
        fontSize: '0.75rem',
        // Projekt-Laufzeitbalken höher machen → größere Drop-Fläche für Dokumente
        padding: isPlanned ? '6px' : '2px 4px',
        minHeight: isPlanned ? '30px' : undefined,
        cursor: isDraggable ? 'grab' : 'pointer',
        opacity: isDraggable ? 1 : 0.9,
      },
    }
  }, [])

  const draggableAccessor = useCallback(
    (event: PlantafelEvent) => event.sourceType === 'einsatz',
    []
  )

  const resizableAccessor = useCallback(
    (event: PlantafelEvent) => event.sourceType === 'einsatz',
    []
  )

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
          {view === 'team' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsSidebarOpen((v) => !v)}
            >
              <PanelRightOpen className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Mitarbeiter</span>
            </Button>
          )}

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

          <ProjectFilterControl filters={filters} setFilters={setFilters} />

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

          <Button
            size="sm"
            onClick={() =>
              setEditor({
                open: true,
                projectId: null,
                initialTab: 'einsatz',
                einsatz: null,
                dateKey: format(currentDate, 'yyyy-MM-dd'),
              })
            }
          >
            <Plus className="h-4 w-4 sm:mr-1" />
            <span className="hidden sm:inline">Neuer Einsatz</span>
          </Button>

          {calendarView === 'day' && (
            <Button size="sm" variant="outline" onClick={handleOpenProjectDialog}>
              <FolderPlus className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Neues Projekt</span>
            </Button>
          )}
        </div>
      </div>

      {/* Farb-Legende (fachliche Einordnung) — nur wenn Projekte sichtbar */}
      {filters.showProjects && calendarView !== 'day' && <PlantafelLegend />}

      {/* Hauptbereich */}
      <div
        className="relative rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
        style={{ height: '70vh' }}
      >
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
          ) : calendarView === 'day' ? (
            <DayView
              date={currentDate}
              events={filteredEvents}
              onCreateProject={handleOpenProjectDialog}
              onProjectClick={handleDayProjectClick}
              onProjectFileDrop={handleDayProjectFileDrop}
              refreshKey={dayRefreshKey}
            />
          ) : (
            <DnDCalendar
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
              components={calendarComponents}
              messages={calendarMessages}
              culture="de"
              toolbar={false}
              style={{ height: '100%', minWidth: calendarView === 'week' ? '600px' : undefined }}
              step={30}
              timeslots={2}
              onDropFromOutside={handleDropFromOutside}
              dragFromOutsideItem={dragFromOutsideItem}
              onEventDrop={handleEventDrop}
              onEventResize={handleEventResize}
              draggableAccessor={draggableAccessor}
              resizableAccessor={resizableAccessor}
              resizable
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

        {view === 'team' && isSidebarOpen && (
          <>
            <div className="fixed inset-0 bg-black/30 z-30 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
            <div className="fixed right-0 top-0 bottom-0 z-40 lg:absolute lg:top-0 lg:bottom-0 lg:right-0 lg:z-10">
              <ProjektSidebar
                employees={employees}
                projects={projects}
                view={view}
                isOpen={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
                onDragStart={handleSidebarDragStart}
                onDragEnd={handleSidebarDragEnd}
              />
            </div>
          </>
        )}
      </div>

      {/* Zentraler Projekt-/Einsatz-Editor (vereinheitlichtes Popup) */}
      {editor.open && (
        <ProjectDayEditDialog
          open={editor.open}
          projectId={editor.projectId}
          projectName={editor.projectName}
          dateKey={editor.dateKey}
          initialTab={editor.initialTab}
          einsatz={editor.einsatz}
          einsatzDefaults={editor.einsatzDefaults}
          projects={projects}
          employees={employees}
          events={events}
          onClose={handleEditorClose}
          onSaved={handleEditorSaved}
          onOpenDetail={handleOpenDetail}
          onEinsatzCreate={createAssignment}
          onEinsatzUpdate={updateAssignment}
          onEinsatzDelete={deleteAssignment}
        />
      )}

      {/* Dokument-Upload per Drag&Drop (2-seitiges Popup) */}
      {docUpload && (
        <DocumentDropUploadDialog
          open={!!docUpload}
          projectId={docUpload.projectId}
          projectName={docUpload.projectName}
          initialFiles={docUpload.files}
          onClose={() => setDocUpload(null)}
          onUploaded={() => handleDocUploaded({ projectId: docUpload.projectId, projectName: docUpload.projectName })}
        />
      )}

      {/* Neues-Projekt-Dialog (Tagesansicht) */}
      <Dialog open={isProjectDialogOpen} onOpenChange={(open) => !open && setIsProjectDialogOpen(false)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogTitle>Neues Projekt erstellen</DialogTitle>
          <ProjectCreateWithGaeb
            onSuccess={handleProjectCreated}
            onCancel={() => setIsProjectDialogOpen(false)}
            initialValues={{
              datumBeginn: format(currentDate, 'yyyy-MM-dd'),
              datumEnde: format(currentDate, 'yyyy-MM-dd'),
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
