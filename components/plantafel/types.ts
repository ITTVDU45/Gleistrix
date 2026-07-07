import type { Employee, Project, Vehicle } from '@/types/main'

// ============================================================================
// VIEW & FILTER TYPES
// ============================================================================

export type PlantafelView = 'team' | 'project'
export type PlantafelCalendarView = 'day' | 'week' | 'month' | 'year'

export type PlantafelEventType =
  | 'einsatz'
  | 'meeting'
  | 'urlaub'
  | 'krankheit'
  | 'sonderurlaub'
  | 'unbezahlt'
  | 'sonstiges'
  | 'feiertag'
  | 'projekt_plan'
  | 'projekt_ist'

export type PlantafelHolidayType = 'german' | 'islamic'

export interface PlantafelDateRange {
  start: Date
  end: Date
}

export interface PlantafelFilters {
  employeeIds: string[]
  projectIds: string[]
  showAbsences: boolean
  showGermanHolidays: boolean
  showIslamicHolidays: boolean
  showProjects: boolean
  hiddenProjectStatuses: string[]
  eventTypes: PlantafelEventType[]
}

// ============================================================================
// CALENDAR EVENT & RESOURCE TYPES
// ============================================================================

export interface PlantafelEvent {
  id: string
  title: string
  start: Date
  end: Date
  resourceId: string
  allDay?: boolean

  type: PlantafelEventType
  sourceType: 'einsatz' | 'meeting' | 'urlaub' | 'feiertag' | 'projekt'
  sourceId: string

  status?: string
  shift?: 'tag' | 'nacht'
  shiftCounts?: { tag: number; nacht: number }
  recordedDays?: number
  notStarted?: boolean

  mitarbeiterId?: string
  mitarbeiterName?: string
  projektId?: string
  projektName?: string

  urlaubTyp?: 'urlaub' | 'krankheit' | 'sonderurlaub' | 'unbezahlt' | 'sonstiges'

  holidayType?: PlantafelHolidayType
  holidayScope?: string

  color?: string
  hasConflict?: boolean
  conflictReason?: string

  notes?: string
  bestaetigt?: boolean
  rolle?: string

  setupDate?: string
  dismantleDate?: string

  /** Verknüpfung zum automatisch erzeugten Projekt-Zeiteintrag (Dual-Write) */
  einsatzLinkId?: string

  /** Join-Link des verknüpften Teams-Meetings (Microsoft-365-Sync) */
  msJoinUrl?: string
}

export interface PlantafelResource {
  resourceId: string
  resourceTitle: string
  type: 'employee' | 'project'

  vorname?: string
  nachname?: string
  aktiv?: boolean

  projektname?: string
  auftraggeber?: string
  status?: string
  baustelle?: string
}

// ============================================================================
// CONFLICT TYPES
// ============================================================================

export interface ConflictInfo {
  id: string
  mitarbeiterId: string
  mitarbeiterName: string

  event1: {
    id: string
    title: string
    type: PlantafelEventType
    start: Date
    end: Date
  }
  event2: {
    id: string
    title: string
    type: PlantafelEventType
    start: Date
    end: Date
  }

  conflictType: 'double_booking' | 'work_during_absence'
  severity: 'warning' | 'error'

  overlapStart: Date
  overlapEnd: Date
}

// ============================================================================
// DAY VIEW TYPES (Excel-Tagesbericht-Karten)
// ============================================================================

export interface PlantafelDayTimeEntry {
  id?: string
  name?: string
  funktion?: string
  start?: string
  ende?: string
  stunden?: number
  extra?: number
  fahrtstunden?: number
  bemerkung?: string
  isExternal?: boolean
  externalCompanyName?: string
  externalFunctionSummary?: string
}

export interface PlantafelDayVehicle {
  id?: string
  type?: string
  licensePlate?: string
  kilometers?: string
  mitarbeiterName?: string
}

export interface PlantafelDayTechnik {
  id?: string
  name?: string
  anzahl?: number
  meterlaenge?: number
  bemerkung?: string
}

export interface PlantafelDayProject {
  id: string
  name: string
  status: string
  auftraggeber: string
  baustelle: string
  auftragsnummer: string
  sapNummer: string
  telefonnummer: string
  atwsImEinsatz: boolean
  anzahlAtws: number
  datumBeginn: string
  datumEnde: string
  zeiten: PlantafelDayTimeEntry[]
  fahrzeuge: PlantafelDayVehicle[]
  technik: PlantafelDayTechnik[]
}

export interface PlantafelDayResponse {
  success: boolean
  data: {
    date: string
    projects: PlantafelDayProject[]
  }
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

export interface PlantafelAssignmentsResponse {
  success: boolean
  data: {
    events: PlantafelEvent[]
    resources: PlantafelResource[]
    conflicts: ConflictInfo[]
    meta: {
      from: string
      to: string
      totalEvents: number
      totalConflicts: number
    }
  }
}

export interface CreatePlantafelAssignmentRequest {
  mitarbeiterId?: string | null
  projektId: string
  von: string
  bis: string
  rolle?: string
  notizen?: string
  bestaetigt?: boolean
  setupDate?: string
  dismantleDate?: string
  einsatzLinkId?: string
}

export interface UpdatePlantafelAssignmentRequest {
  mitarbeiterId?: string | null
  projektId?: string
  von?: string
  bis?: string
  rolle?: string
  notizen?: string
  bestaetigt?: boolean
  setupDate?: string | null
  dismantleDate?: string | null
  einsatzLinkId?: string | null
}

// ============================================================================
// MAPPER FUNCTIONS
// ============================================================================

export const UNASSIGNED_RESOURCE_ID = '__unassigned__'

export function mapEmployeeToResource(employee: Employee): PlantafelResource {
  return {
    resourceId: employee.id,
    resourceTitle: employee.name,
    type: 'employee',
    aktiv: employee.status === 'aktiv',
  }
}

export function mapProjectToResource(project: Project): PlantafelResource {
  return {
    resourceId: project.id,
    resourceTitle: project.name,
    type: 'project',
    projektname: project.name,
    auftraggeber: project.auftraggeber,
    status: project.status,
    baustelle: project.baustelle,
  }
}

export function checkOverlap(
  start1: Date, end1: Date,
  start2: Date, end2: Date
): boolean {
  return start1 < end2 && start2 < end1
}

export function getOverlapPeriod(
  start1: Date, end1: Date,
  start2: Date, end2: Date
): { start: Date; end: Date } | null {
  if (!checkOverlap(start1, end1, start2, end2)) return null
  return {
    start: new Date(Math.max(start1.getTime(), start2.getTime())),
    end: new Date(Math.min(end1.getTime(), end2.getTime())),
  }
}
