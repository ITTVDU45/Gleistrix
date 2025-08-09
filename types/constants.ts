import type { ProjectStatus, MitarbeiterFunktion } from './main';

// ===== PROJECT STATUS OPTIONS =====
export const PROJECT_STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: 'aktiv', label: 'Aktiv' },
  { value: 'pausiert', label: 'Pausiert' },
  { value: 'abgeschlossen', label: 'Abgeschlossen' },
  { value: 'fertiggestellt', label: 'Fertiggestellt' },
  { value: 'geleistet', label: 'Geleistet' },
  { value: 'kein Status', label: 'Kein Status' }
];

// ===== MITARBEITER FUNKTION OPTIONS =====
export const MITARBEITER_FUNKTION_OPTIONS: { value: MitarbeiterFunktion; label: string }[] = [
  { value: 'SIPO', label: 'SIPO' },
  { value: 'HFE', label: 'HFE' },
  { value: 'Monteur/bediener', label: 'Monteur/Bediener' },
  { value: 'Sakra', label: 'Sakra' },
  { value: 'BüP', label: 'BüP' },
  { value: 'HiBa', label: 'HiBa' },
  { value: 'SAS', label: 'SAS' },
  { value: 'Bahnerder', label: 'Bahnerder' }
];

// ===== CHART COLORS =====
export const CHART_COLORS = [
  '#0088FE', '#00C49F', '#FFBB28', '#FF8042', 
  '#8884d8', '#82ca9d', '#ffc658', '#ff7300'
];

// ===== TABLE COLUMNS =====
export const PROJECT_TABLE_COLUMNS = [
  { key: 'name', label: 'Projekt' },
  { key: 'auftraggeber', label: 'Auftraggeber' },
  { key: 'baustelle', label: 'Baustelle' },
  { key: 'status', label: 'Status' },
  { key: 'datumBeginn', label: 'Datum' },
  { key: 'actions', label: 'Aktionen' }
];

export const EMPLOYEE_TABLE_COLUMNS = [
  { key: 'name', label: 'Name' },
  { key: 'projects', label: 'Projekte' },
  { key: 'assignments', label: 'Einsätze' },
  { key: 'totalHours', label: 'Geleistete Stunden' },
  { key: 'travelHours', label: 'Fahrtstunden' },
  { key: 'actions', label: 'Aktionen' }
];

export const VEHICLE_TABLE_COLUMNS = [
  { key: 'type', label: 'Fahrzeugtyp / Modell' },
  { key: 'licensePlate', label: 'Kennzeichen' },
  { key: 'projectCount', label: 'Einsatz in Projekten' }
];

export const TIMETRACKING_TABLE_COLUMNS = [
  { key: 'date', label: 'Datum' },
  { key: 'projectName', label: 'Projekt' },
  { key: 'name', label: 'Mitarbeiter' },
  { key: 'start', label: 'Start' },
  { key: 'ende', label: 'Ende' },
  { key: 'stunden', label: 'Stunden' },
  { key: 'fahrtstunden', label: 'Fahrtstunden' },
  { key: 'nachtzulage', label: 'Nachtzulage' }
];

// ===== FORM LABELS =====
export const PROJECT_FORM_LABELS = {
  name: 'Projektname',
  auftraggeber: 'Auftraggeber',
  baustelle: 'Baustelle',
  auftragsnummer: 'Auftragsnummer',
  sapNummer: 'SAP Nummer',
  telefonnummer: 'Ansprechpartner',
  status: 'Status',
  datumBeginn: 'Datum Beginn',
  datumEnde: 'Datum Ende',
  atwsImEinsatz: 'ATWs im Einsatz',
  anzahlAtws: 'Anzahl ATWs'
};

export const EMPLOYEE_FORM_LABELS = {
  name: 'Name'
};

export const VEHICLE_FORM_LABELS = {
  type: 'Fahrzeugtyp / Modell',
  licensePlate: 'Kennzeichen',
  fuelAmount: 'Tankbetrag (falls Ja)',
  damages: 'Schäden / Auffälligkeiten',
  kilometers: 'gefahrene Projektkilometer'
};

// ===== VALIDATION MESSAGES =====
export const VALIDATION_MESSAGES = {
  required: 'Dieses Feld ist erforderlich',
  invalidEmail: 'Bitte geben Sie eine gültige E-Mail-Adresse ein',
  minLength: (min: number) => `Mindestens ${min} Zeichen erforderlich`,
  maxLength: (max: number) => `Maximal ${max} Zeichen erlaubt`,
  invalidDate: 'Bitte geben Sie ein gültiges Datum ein',
  invalidNumber: 'Bitte geben Sie eine gültige Zahl ein',
  atwsRequired: 'Anzahl ATWs muss mindestens 1 sein, wenn ATWs im Einsatz sind'
};

// ===== SUCCESS MESSAGES =====
export const SUCCESS_MESSAGES = {
  projectCreated: 'Projekt erfolgreich erstellt',
  projectUpdated: 'Projekt erfolgreich aktualisiert',
  projectDeleted: 'Projekt erfolgreich gelöscht',
  employeeCreated: 'Mitarbeiter erfolgreich erstellt',
  employeeUpdated: 'Mitarbeiter erfolgreich aktualisiert',
  employeeDeleted: 'Mitarbeiter erfolgreich gelöscht',
  vehicleCreated: 'Fahrzeug erfolgreich erstellt',
  vehicleUpdated: 'Fahrzeug erfolgreich aktualisiert',
  vehicleDeleted: 'Fahrzeug erfolgreich gelöscht',
  technikAdded: 'Technik erfolgreich hinzugefügt',
  technikUpdated: 'Technik erfolgreich bearbeitet',
  technikDeleted: 'Technik erfolgreich gelöscht',
  timeEntryAdded: 'Zeiteintrag erfolgreich hinzugefügt',
  vehicleAssigned: 'Fahrzeug erfolgreich zugewiesen'
};

// ===== ERROR MESSAGES =====
export const ERROR_MESSAGES = {
  projectNotFound: 'Projekt nicht gefunden',
  employeeNotFound: 'Mitarbeiter nicht gefunden',
  vehicleNotFound: 'Fahrzeug nicht gefunden',
  technikNotFound: 'Technik-Eintrag nicht gefunden',
  invalidId: 'Ungültige ID',
  serverError: 'Serverfehler aufgetreten',
  networkError: 'Netzwerkfehler aufgetreten',
  validationError: 'Validierungsfehler',
  unknownError: 'Unbekannter Fehler aufgetreten'
};

// ===== PAGE TITLES =====
export const PAGE_TITLES = {
  dashboard: 'Dashboard',
  projects: 'Projekte',
  createProject: 'Neues Projekt erstellen',
  editProject: 'Projekt bearbeiten',
  projectDetail: 'Projektdetails',
  employees: 'Mitarbeiter',
  employeeDetail: 'Mitarbeiterdetails',
  vehicles: 'Fahrzeuge',
  timeTracking: 'Zeiterfassung',
  settings: 'Einstellungen'
};

// ===== NAVIGATION ITEMS =====
export const NAVIGATION_ITEMS = [
  { name: 'Dashboard', href: '/dashboard', icon: 'Home' },
  { name: 'Projekte', href: '/projekte', icon: 'Building2' },
  { name: 'Mitarbeiter', href: '/mitarbeiter', icon: 'Users' },
  { name: 'Fahrzeuge', href: '/fahrzeuge', icon: 'Truck' },
  { name: 'Zeiterfassung', href: '/timetracking', icon: 'Clock' }
];

// ===== DASHBOARD STATISTICS LABELS =====
export const DASHBOARD_STATS_LABELS = {
  activeProjects: 'Aktive Projekte',
  totalHours: 'Gesamtstunden',
  activeVehicles: 'Fahrzeuge',
  totalEmployees: 'Mitarbeiter'
};

// ===== EXPORT FILENAMES =====
export const EXPORT_FILENAMES = {
  dashboardStats: 'Dashboard_Statistiken',
  timeTracking: 'Zeiterfassung',
  employeeDetails: 'Mitarbeiterdetails',
  projectDetails: 'Projektdetails'
}; 