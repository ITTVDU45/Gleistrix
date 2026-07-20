import type { Vehicle, Project } from '../../types';

export type VehicleStatus = 'verfügbar' | 'im_einsatz' | 'wartung' | 'nicht_verfügbar';

export interface VehicleStatusInfo {
  status: VehicleStatus;
  color: string;
  message: string;
  projectName?: string;
  projectId?: string;
}

export function getVehicleStatus(
  vehicle: Vehicle, 
  projects: Project[] = [], 
  targetDate?: string
): VehicleStatusInfo {
  const today = targetDate || new Date().toISOString().split('T')[0];
  const todayDate = new Date(today);

  // Prüfe manuellen Status zuerst
  if (vehicle.manualStatus === 'wartung') {
    return {
      status: 'wartung',
      color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      message: 'In Wartung' + (vehicle.statusNote ? `: ${vehicle.statusNote}` : '')
    };
  }

  if (vehicle.manualStatus === 'nicht_verfügbar') {
    return {
      status: 'nicht_verfügbar',
      color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      message: 'Nicht verfügbar' + (vehicle.statusNote ? `: ${vehicle.statusNote}` : '')
    };
  }

  // Prüfe aktive Projekt-Zuweisungen
  const activeAssignments = projects.filter(project => {
    const projectStart = new Date(project.datumBeginn);
    const projectEnd = new Date(project.datumEnde);
    
    // Projekt läuft am Ziel-Datum
    const isActive = projectStart <= todayDate && todayDate <= projectEnd;
    
    if (!isActive) return false;

    // Prüfe ob Fahrzeug diesem Projekt zugewiesen ist
    if (!project.fahrzeuge) return false;

    // Prüfe alle Tage des Projekts
    return Object.values(project.fahrzeuge).some((dayVehicles: any) => {
      if (!Array.isArray(dayVehicles)) return false;
      return dayVehicles.some((v: any) => v.id === vehicle.id);
    });
  });

  if (activeAssignments.length > 0) {
    const project = activeAssignments[0]; // Nimm das erste aktive Projekt
    return {
      status: 'im_einsatz',
      color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      message: `Im Einsatz bei ${project.name}`,
      projectName: project.name,
      projectId: project.id
    };
  }

  // Standard: Verfügbar
  return {
    status: 'verfügbar',
    color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    message: 'Verfügbar'
  };
}

export function isVehicleAvailableForDate(
  vehicle: Vehicle, 
  projects: Project[], 
  targetDate: string,
  excludeProjectId?: string // Optional: Projekt-ID ausschließen (für Bearbeitung)
): boolean {
  // Prüfe nur manuellen Status - keine Blockierung durch andere Projekte
  if (vehicle.manualStatus === 'wartung' || vehicle.manualStatus === 'nicht_verfügbar') {
    return false;
  }

  // Fahrzeug ist verfügbar (keine Blockierung durch andere Projekte)
  return true;
}

export function getAvailableVehiclesForDate(
  vehicles: Vehicle[], 
  projects: Project[], 
  targetDate: string,
  excludeProjectId?: string // Optional: Projekt-ID ausschließen
): Vehicle[] {
  // Alle Fahrzeuge sind verfügbar, außer wenn sie manuell auf "wartung" oder "nicht_verfügbar" gesetzt sind
  return vehicles.filter(vehicle => 
    vehicle.manualStatus !== 'wartung' && vehicle.manualStatus !== 'nicht_verfügbar'
  );
} 