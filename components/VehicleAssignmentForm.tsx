"use client";
import React, { useState, useEffect, useMemo, ReactNode } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Checkbox } from './ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Alert } from './ui/alert'
import { format, parseISO, addDays } from 'date-fns'
import { de } from 'date-fns/locale'
import type { Project, Vehicle, Employee } from '../types'
import { AlertCircle, Loader2 } from 'lucide-react'
import { useEmployees } from '../hooks/useEmployees'
import { useVehicles } from '../hooks/useVehicles'
import { useProjects } from '../hooks/useProjects'

interface VehicleAssignmentFormProps {
  project: Project
  vehicles: Vehicle[]
  onVehicleAssigned: (date: string[], vehicle: Vehicle) => void
  onClose: () => void
}

export function VehicleAssignmentForm({ project, vehicles, onVehicleAssigned, onClose }: VehicleAssignmentFormProps) {
  const [selectedVehicle, setSelectedVehicle] = useState<string>('')
  const [selectedEmployee, setSelectedEmployee] = useState<string>('')
  const [selectedDays, setSelectedDays] = useState<string[]>([])
  const [selectAllDays, setSelectAllDays] = useState(false)
  const [error, setError] = useState<string | ReactNode | null>(null)
  const [availableVehicles, setAvailableVehicles] = useState<Vehicle[]>([])
  const [isLoading, setIsLoading] = useState(true)
  
  // Lade Mitarbeiter und Fahrzeuge über Hooks
  const { employees, loading: employeesLoading } = useEmployees()
  const { vehicles: allVehicles, loading: vehiclesLoading } = useVehicles()
  const { projects: allProjects } = useProjects()

  // Memoisiere die Projekttage, damit sich die Referenz nur bei Änderung der Projektdaten ändert
  const projectDays = useMemo(() => getProjectDays(project), [project.datumBeginn, project.datumEnde]);

  function getProjectDays(project: Project): string[] {
    const startDate = parseISO(project.datumBeginn)
    const endDate = parseISO(project.datumEnde)
    const days: string[] = []
    let currentDate = startDate
    while (currentDate <= endDate) {
      days.push(format(currentDate, 'yyyy-MM-dd'))
      currentDate = addDays(currentDate, 1)
    }
    return days
  }

  // Berechne verfügbare Fahrzeuge basierend auf den geladenen Daten
  useEffect(() => {
    if (vehiclesLoading) return;
    try {
      // Filtere nur Fahrzeuge mit manuellen Status-Blockierungen
      const filteredVehicles = allVehicles.filter(vehicle => {
        // Nur Fahrzeuge ausschließen, die manuell auf "wartung" oder "nicht_verfügbar" gesetzt sind
        return vehicle.manualStatus !== 'wartung' && vehicle.manualStatus !== 'nicht_verfügbar';
      });
      setAvailableVehicles(filteredVehicles);
      setIsLoading(false);
    } catch (err) {
      setError('Fehler beim Laden der Fahrzeuge');
      setIsLoading(false);
    }
  }, [allVehicles, vehiclesLoading]);

  // Hilfsfunktion: Prüft, ob das Fahrzeug an diesem Tag in einem anderen Projekt zugewiesen ist
  // (Wird nicht mehr verwendet, da keine Blockierung mehr existiert)
  function isVehicleAssignedElsewhere(vehicleId: string, day: string, currentProjectId: string, projects: Project[]): boolean {
    return false; // Keine Blockierung mehr
  }

  // Behandle "Alle Tage auswählen" Checkbox
  const handleSelectAllDays = (checked: boolean) => {
    setSelectAllDays(checked)
    if (checked) {
      setSelectedDays(projectDays); // Alle Tage sind verfügbar
    } else {
      setSelectedDays([])
    }
  }

  // Behandle einzelne Tag-Auswahl
  const handleDayToggle = (day: string) => {
    setSelectedDays(prev => {
      const newSelectedDays = prev.includes(day)
        ? prev.filter(d => d !== day)
        : [...prev, day]
      
      // Update selectAllDays basierend auf der neuen Auswahl
      setSelectAllDays(newSelectedDays.length === getProjectDays(project).length)
      
      return newSelectedDays
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedVehicle || selectedDays.length === 0) {
      setError('Bitte wählen Sie ein Fahrzeug aus und mindestens einen Tag!')
      return
    }
    
    const vehicle = availableVehicles.find(v => v.id === selectedVehicle)
    if (!vehicle) {
      setError('Fahrzeug nicht gefunden')
      return
    }

    // Finde den ausgewählten Mitarbeiter
    const selectedEmployeeData = employees.find(emp => emp.id === selectedEmployee);
    const mitarbeiterName = selectedEmployee === "none" ? "" : (selectedEmployeeData ? selectedEmployeeData.name : "");

    // Erstelle ein erweitertes Fahrzeug-Objekt mit Mitarbeiterinformationen
    const vehicleWithEmployee = {
      ...vehicle,
      mitarbeiterName: mitarbeiterName
    }

    // Filtere nur Tage, an denen das Fahrzeug noch nicht zugewiesen ist
    const assignableDays = selectedDays.filter(day =>
      !(
        project.fahrzeuge &&
        Array.isArray(project.fahrzeuge[day]) &&
        project.fahrzeuge[day].some((v: any) => v.id === vehicle.id)
      )
    );

    if (assignableDays.length === 0) {
      setError('Das Fahrzeug ist für alle ausgewählten Tage bereits in diesem Projekt zugewiesen.');
      return;
    }

    try {
      // Fahrzeug für alle noch nicht belegten Tage in einem Rutsch zuweisen
      await onVehicleAssigned(assignableDays, vehicleWithEmployee)
      onClose()
    } catch (err) {
      setError('Fehler beim Zuweisen des Fahrzeugs')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full flex flex-col gap-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="vehicle" className="text-sm font-semibold text-slate-700">
            Fahrzeug auswählen *
          </Label>
          {isLoading || vehiclesLoading ? (
            <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-none">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm text-slate-600">Lade Fahrzeuge...</span>
            </div>
          ) : availableVehicles.length > 0 ? (
            <Select value={selectedVehicle} onValueChange={setSelectedVehicle}>
              <SelectTrigger className="rounded-xl border-slate-200 focus:border-purple-500 focus:ring-purple-500 h-12">
                <SelectValue placeholder="Fahrzeug wählen" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {availableVehicles.map((vehicle) => (
                  <SelectItem key={vehicle.id} value={vehicle.id}>
                    {vehicle.type} - {vehicle.licensePlate}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-none text-yellow-700 text-sm">
              <AlertCircle className="h-4 w-4 inline mr-2" />
              Keine Fahrzeuge verfügbar für dieses Projekt
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="employee" className="text-sm font-semibold text-slate-700">
            Mitarbeiter zuweisen
          </Label>
          {employeesLoading ? (
            <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm text-slate-600">Lade Mitarbeiter...</span>
            </div>
          ) : employees.length > 0 ? (
            <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
              <SelectTrigger className="rounded-xl border-slate-200 focus:border-purple-500 focus:ring-purple-500 h-12">
                <SelectValue placeholder="Mitarbeiter wählen (optional)" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="none">
                  Kein Mitarbeiter zugewiesen
                </SelectItem>
                {employees.map((employee) => (
                  <SelectItem key={employee.id} value={employee.id}>
                    {employee.name} {employee.position ? `(${employee.position})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-xl text-yellow-700 text-sm">
              <AlertCircle className="h-4 w-4 inline mr-2" />
              Keine Mitarbeiter verfügbar
            </div>
          )}
        </div>

        <div className="flex items-center space-x-3 p-3 bg-slate-50 rounded-none">
          <Checkbox 
            id="selectAllDays"
            checked={selectAllDays} 
            onCheckedChange={handleSelectAllDays} 
            className="rounded"
          />
          <Label htmlFor="selectAllDays" className="text-sm font-medium text-slate-700">
            Alle Tage auswählen
          </Label>
        </div>

        <div className="space-y-3 project-vehicles-add">
          <Label className="text-sm font-semibold text-slate-700">
            Einsatztage auswählen *
          </Label>
                      <div className="flex flex-wrap gap-2 p-3 bg-slate-50 rounded-none max-h-32 overflow-y-auto">
              {projectDays.map(day => (
                <Button
                  key={day}
                  type="button"
                  variant={selectedDays.includes(day) ? 'default' : 'outline'}
                  size="sm"
                  className={`rounded-xl transition-all duration-200 ${
                    selectedDays.includes(day)
                      ? 'bg-purple-600 hover:bg-purple-700 text-white'
                      : 'border-slate-200 hover:bg-slate-100'
                  }`}
                  onClick={() => handleDayToggle(day)}
                >
                  {format(parseISO(day), 'dd.MM.yyyy', { locale: de })}
                </Button>
              ))}
            </div>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="rounded-xl border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
        </Alert>
      )}

      <div className="flex gap-3 justify-end pt-4 border-t border-slate-100">
        <Button 
          variant="outline" 
          onClick={onClose} 
          className="rounded-xl h-12 px-6 border-slate-200 hover:bg-slate-50"
        >
          Abbrechen
        </Button>
        <Button 
          type="submit" 
          disabled={isLoading || vehiclesLoading || availableVehicles.length === 0 || selectedDays.length === 0}
          className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl h-12 px-6 shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Fahrzeug zuweisen
        </Button>
      </div>
    </form>
  )
} 