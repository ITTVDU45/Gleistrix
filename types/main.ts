// ===== GRUNDLEGENDE TYPEN =====
export type ProjectStatus = 'aktiv' | 'pausiert' | 'abgeschlossen' | 'fertiggestellt' | 'geleistet' | 'kein Status'
export type MitarbeiterFunktion = 'SIPO' | 'HFE' | 'Monteur/bediener' | 'Sakra' | 'BüP' | 'HiBa' | 'SAS' | 'Bahnerder'
export type SnackbarSeverity = 'success' | 'error' | 'warning' | 'info'

// ===== API RESPONSE TYPEN =====
export interface ApiResponse<T> {
  success: boolean
  data?: T
  message?: string
  error?: string
}

export interface ProjectApiResponse extends ApiResponse<Project> {}
export interface EmployeeApiResponse extends ApiResponse<Employee> {}
export interface VehicleApiResponse extends ApiResponse<Vehicle> {}

// ===== GRUNDLEGENDE ENTITIES =====
export interface VacationDay {
  id?: string
  startDate: Date | string
  endDate: Date | string
  reason?: string
  approved?: boolean
}

export interface Employee {
  id: string
  name: string
  miNumber?: number
  position?: string
  email?: string
  phone?: string
  status?: EmployeeStatus
  elbaId?: string
  address?: string
  postalCode?: string
  city?: string
  einsaetze: EmployeeAssignment[]
  vacationDays?: VacationDay[]
}

export type EmployeeStatus = 'aktiv' | 'nicht aktiv' | 'urlaub'

export interface EmployeeAssignment {
  projektId: string
  datum: string
  stunden: number
  fahrtstunden?: number
  funktion?: string
}

export interface TimeEntry {
  id: string
  name: string
  funktion: MitarbeiterFunktion
  start: string
  ende: string
  stunden: number
  fahrtstunden: number
  pause: string
  extra: number
  nachtzulage: string
  sonntag: number
  feiertag: number
  bemerkung: string
}

export interface TechnikEntry {
  id: string
  name: string
  anzahl: number
  meterlaenge: number
  bemerkung?: string
}

export interface Vehicle {
  id: string
  type: string
  licensePlate: string
  projectCount?: number
  kilometers?: string
}

export interface VehicleAssignment {
  id: string
  type: string
  licensePlate: string
  kilometers?: string
}

export interface Project {
  id: string;
  name: string;
  auftragsnummer: string;
  sapNummer: string;
  auftraggeber: string;
  datumBeginn?: string;
  datumEnde?: string;
  status: ProjectStatus | string;
  baustelle?: string;
  mitarbeiterZeiten?: { [date: string]: TimeEntry[] };
  technik?: { [date: string]: any[] };
  fahrzeuge?: { [date: string]: any[] };
}

// ===== FORM VALIDATION TYPEN =====
export interface ProjectFormData {
  name: string
  auftraggeber: string
  baustelle: string
  auftragsnummer: string
  sapNummer: string
  telefonnummer: string
  status: ProjectStatus
  datumBeginn: string
  datumEnde: string
  atwsImEinsatz: boolean
  anzahlAtws: number
}

export interface EmployeeFormData {
  name: string
  position?: string
  email?: string
  phone?: string
  status?: EmployeeStatus
  elbaId?: string
  address?: string
  postalCode?: string
  city?: string
}

export interface VehicleFormData {
  type: string
  licensePlate: string
  fuelAmount?: string
  damages?: string
  kilometers?: string
}

export interface TimeEntryFormData {
  projectName: string
  date: string
  orderNumber: string
  sapNumber: string
  client: string
  status: ProjectStatus
  name: string
  funktion: MitarbeiterFunktion
  start: string
  ende: string
  pause: string
  extra: number
  fahrtstunden: number
  feiertag: number
  sonntag: number
  bemerkung: string
  nachtzulage: string
}

export interface VehicleAssignmentFormData {
  date: string
  vehicle: VehicleAssignment
}

export interface TechnikAssignmentFormData {
  date: string
  technik: TechnikEntry
}

// ===== FILTER TYPEN =====
export interface ProjectFilters {
  name?: string
  auftraggeber?: string
  baustelle?: string
  status?: ProjectStatus
  dateFrom?: string
  dateTo?: string
}

export interface TimeTrackingFilters {
  projects?: string[]
  employees?: string[]
  dateRange?: {
    from: Date
    to: Date
  }
  orderNumbers?: string[]
  sapNumbers?: string[]
  clients?: string[]
  statuses?: ProjectStatus[]
}

// ===== DASHBOARD STATISTIK TYPEN =====
export interface DashboardStats {
  activeProjects: number
  totalHours: number
  activeVehicles: number
  totalEmployees: number
}

export interface ChartData {
  name: string
  value: number
  [key: string]: any
}

export interface MonthlyHoursData {
  month: string
  stunden: number
  fahrtstunden: number
}

export interface EmployeeUtilizationData {
  name: string
  stunden: number
  projekte: number
}

export interface ATWUsageData {
  name: string
  anzahl: number
}

// ===== UI STATE TYPEN =====
export interface SnackbarState {
  open: boolean
  message: string
  severity: SnackbarSeverity
}

export interface DialogState {
  isOpen: boolean
  data?: any
}

// ===== ERWEITERTE ENTITY TYPEN =====
export interface EmployeeStats {
  totalHours: number
  totalTravelHours: number
  uniqueProjects: number
  totalAssignments: number
}

export interface ProjectStats {
  totalHours: number
  totalTechnik: number
  totalVehicles: number
  totalEmployees: number
}

// ===== TECHNIK OPERATIONEN =====
export interface TechnikOperationData {
  date: string
  technikId?: string
  technik?: TechnikEntry
  updatedTechnik?: TechnikEntry
}

// ===== ZEITTRACKING EXPORT TYPEN =====
export interface TimeTrackingExportData {
  date: string
  projectName: string
  name: string
  start: string
  ende: string
  stunden: number
  fahrtstunden: number
  nachtzulage: number
  orderNumber: string
  sapNumber: string
  client: string
  status: ProjectStatus
} 