"use client";
import React, { useState } from 'react'
import { Button } from './ui/button'
import { Table, TableBody, TableCell, TableHeader, TableHead, TableRow } from './ui/table'
import { Badge } from './ui/badge'
import type { Project, Vehicle } from '../types'
import { format, parseISO, addDays } from 'date-fns'
import { de } from 'date-fns/locale'
import { getVehicleStatus } from '../lib/utils/vehicleStatus'
import { useEmployees } from '../hooks/useEmployees'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Input } from './ui/input'
import { Alert, AlertDescription } from './ui/alert'
import { Loader2 } from 'lucide-react'
import { ProjectVehiclesApi } from '@/lib/api/projectVehicles'
import { Checkbox } from './ui/checkbox'

interface VehicleAssignmentListProps {
  project: Project
  vehicles: Vehicle[]
  onEdit: (date: string, vehicle: any) => void
  selectedDate: string
  onDateChange: (date: string) => void
}

export default function VehicleAssignmentList({ project, vehicles, onEdit, selectedDate, onDateChange }: VehicleAssignmentListProps) {
  const projectDays: string[] = (() => {
    const startDate = parseISO(project.datumBeginn)
    const endDate = parseISO(project.datumEnde)
    const days: string[] = []
    let currentDate = startDate
    while (currentDate <= endDate) {
      days.push(format(currentDate, 'yyyy-MM-dd'))
      currentDate.setDate(currentDate.getDate() + 1)
    }
    return days
  })()

  const { employees, loading: employeesLoading } = useEmployees();
  const [localVehiclesByDay, setLocalVehiclesByDay] = useState<Record<string, any[]>>(() => ({ ...(project.fahrzeuge || {}) }))
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  // Synchronisiere lokale Ansicht, wenn sich das Projekt ändert
  React.useEffect(() => {
    setLocalVehiclesByDay({ ...(project.fahrzeuge || {}) })
  }, [project.fahrzeuge])

  const [editVehicle, setEditVehicle] = useState<any>(null);
  const [editMitarbeiter, setEditMitarbeiter] = useState<string>('none');
  const [editKilometers, setEditKilometers] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editSelectedDays, setEditSelectedDays] = useState<string[]>([]);
  const [editSelectAllDays, setEditSelectAllDays] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{date: string, vehicleId: string} | null>(null);

  // Synchronisiere Checkbox-Status mit ausgewählten Tagen
  React.useEffect(() => {
    setEditSelectAllDays(editSelectedDays.length === projectDays.length && projectDays.length > 0);
  }, [editSelectedDays, projectDays]);

  const handleEditSelectAllDays = (checked: boolean) => {
    setEditSelectAllDays(checked);
    if (checked) {
      setEditSelectedDays(projectDays);
    } else {
      setEditSelectedDays([]);
    }
  };

  const handleEditClick = (date: string, vehicle: any) => {
    setEditVehicle({ ...vehicle, date });
    setEditMitarbeiter(vehicle.mitarbeiterName ? (employees.find(e => e.name === vehicle.mitarbeiterName)?.id || 'none') : 'none');
    setEditKilometers(vehicle.kilometers || '');
    const assignedDays = Object.entries(localVehiclesByDay || {})
      .filter(([day, arr]) => Array.isArray(arr) && arr.some((v: any) => v.id === vehicle.id))
      .map(([day]) => day);
    setEditSelectedDays(assignedDays);
    setEditDialogOpen(true);
  };

  const handleEditDayToggle = (day: string) => {
    setEditSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const handleEditSave = async () => {
    if (!editVehicle) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const assignedDays = Object.entries(localVehiclesByDay || {})
        .filter(([day, arr]) => Array.isArray(arr) && arr.some((v: any) => v.id === editVehicle.id))
        .map(([day]) => day);
      const daysToRemove = assignedDays.filter(day => !editSelectedDays.includes(day));
      for (const day of daysToRemove) {
        await ProjectVehiclesApi.unassign(project.id, { date: day, vehicleId: editVehicle.id })
        setLocalVehiclesByDay(prev => {
          const next = { ...prev }
          next[day] = (next[day] || []).filter((v: any) => v.id !== editVehicle.id)
          return next
        })
      }
      const daysToAdd = editSelectedDays.filter(day =>
        !assignedDays.includes(day) &&
        !(
          project.fahrzeuge &&
          Array.isArray(project.fahrzeuge[day]) &&
          project.fahrzeuge[day].some((v: any) => v.id === editVehicle.id)
        )
      );
      for (const day of daysToAdd) {
        const updatedVehicle = {
          ...editVehicle,
          kilometers: editKilometers,
          mitarbeiterName: editMitarbeiter !== 'none' ? (employees.find(e => e.id === editMitarbeiter)?.name || '') : ''
        };
        await ProjectVehiclesApi.assign(project.id, { date: day, vehicle: updatedVehicle })
        setLocalVehiclesByDay(prev => {
          const next = { ...prev }
          const arr = next[day] ? [...next[day]] : []
          if (!arr.some((v: any) => v.id === updatedVehicle.id)) {
            arr.push(updatedVehicle)
          }
          next[day] = arr
          return next
        })
      }
      const daysToUpdate = assignedDays.filter(day => editSelectedDays.includes(day));
      for (const day of daysToUpdate) {
        const updatedFields: any = {
          kilometers: editKilometers
        };
        if (editMitarbeiter !== 'none') {
          const emp = employees.find(e => e.id === editMitarbeiter);
          updatedFields.mitarbeiterName = emp ? emp.name : '';
        } else {
          updatedFields.mitarbeiterName = '';
        }
        await ProjectVehiclesApi.update(project.id, {
          date: day,
          vehicleId: editVehicle.id,
          updatedFields,
        })
        setLocalVehiclesByDay(prev => {
          const next = { ...prev }
          next[day] = (next[day] || []).map((v: any) =>
            v.id === editVehicle.id ? { ...v, ...updatedFields } : v
          )
          return next
        })
      }
      setEditDialogOpen(false);
      setIsSubmitting(false);
      setError(null);
    } catch (err) {
      setError('Fehler beim Bearbeiten der Fahrzeugzuweisung');
      setIsSubmitting(false);
    }
  };

  const handleRemoveClick = (date: string, vehicleId: string) => {
    setDeleteTarget({ date, vehicleId });
    setDeleteDialogOpen(true);
  };

  const handleRemove = async (date: string, vehicleId: string) => {
    try {
      await ProjectVehiclesApi.unassign(project.id, { date, vehicleId })
      setLocalVehiclesByDay(prev => {
        const next = { ...prev }
        next[date] = (next[date] || []).filter((v: any) => v.id !== vehicleId)
        return next
      })
    } catch (err) {
      // Optional: Fehlerbehandlung
    }
  };

  const handleRemoveConfirm = async () => {
    if (!deleteTarget) return;
    setDeleteDialogOpen(false);
    setDeleteTarget(null);
    setEditDialogOpen(false);
    setEditVehicle(null);
    setEditMitarbeiter('none');
    setEditKilometers('');
    setEditSelectedDays([]);
    setEditSelectAllDays(false);
    await handleRemove(deleteTarget.date, deleteTarget.vehicleId);
  };

  const handleRemoveCancel = () => {
    setDeleteDialogOpen(false);
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Zugewiesene Fahrzeuge</h3>
      
      {/* Date Navigation Buttons */}
      <div className="flex flex-wrap gap-1 border-b border-gray-200 pb-2">
        {projectDays.map((date) => (
          <Button
            key={date}
            variant={selectedDate === date ? 'default' : 'outline'}
            size="sm"
            onClick={() => onDateChange(date)}
            className="min-w-[120px]"
          >
            {format(parseISO(date), 'dd.MM.yyyy', { locale: de })}
          </Button>
        ))}
      </div>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-lg rounded-2xl border-0 shadow-2xl bg-white max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Fahrzeugzuweisung bearbeiten</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold mb-1">Mitarbeiter</label>
              {employeesLoading ? (
                <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-slate-600">Lade Mitarbeiter...</span>
                </div>
              ) : (
                <Select value={editMitarbeiter} onValueChange={setEditMitarbeiter}>
                  <SelectTrigger className="rounded-xl border-slate-200 focus:border-purple-500 focus:ring-purple-500 h-12">
                    <SelectValue placeholder="Mitarbeiter wählen (optional)" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="none">Kein Mitarbeiter zugewiesen</SelectItem>
                    {employees.map((employee) => (
                      <SelectItem key={employee.id} value={employee.id}>
                        {employee.name} {employee.position ? `(${employee.position})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">Gefahrene Projektkilometer</label>
              <Input
                value={editKilometers}
                onChange={e => setEditKilometers(e.target.value)}
                placeholder="z.B. 1500 km"
                className="rounded-xl border-slate-200 focus:border-purple-500 focus:ring-purple-500 h-12"
              />
            </div>
            <div className="flex items-center space-x-3 p-3 bg-slate-50 rounded-xl">
              <Checkbox
                id="editSelectAllDays"
                checked={editSelectAllDays}
                onCheckedChange={handleEditSelectAllDays}
                className="rounded"
              />
              <label htmlFor="editSelectAllDays" className="text-sm font-medium text-slate-700">
                Alle Tage auswählen
              </label>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">Einsatztage</label>
              <div className="flex flex-wrap gap-2 p-3 bg-slate-50 rounded-xl max-h-32 overflow-y-auto">
                {projectDays.map(day => (
                  <Button
                    key={day}
                    type="button"
                    variant={editSelectedDays.includes(day) ? 'default' : 'outline'}
                    size="sm"
                    className={`rounded-xl transition-all duration-200 ${
                      editSelectedDays.includes(day)
                        ? 'bg-purple-600 hover:bg-purple-700 text-white'
                        : 'border-slate-200 hover:bg-slate-100'
                    }`}
                    onClick={() => handleEditDayToggle(day)}
                  >
                    {format(parseISO(day), 'dd.MM.yyyy', { locale: de })}
                  </Button>
                ))}
              </div>
            </div>
            {error && (
              <Alert variant="destructive" className="rounded-xl">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <Button variant="outline" onClick={() => setEditDialogOpen(false)} disabled={isSubmitting}>
                Abbrechen
              </Button>
              <Button onClick={handleEditSave} disabled={isSubmitting} className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl h-12 px-6">
                {isSubmitting ? 'Speichern...' : 'Speichern'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-xl bg-white dark:bg-slate-800">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
              Fahrzeug-Zuweisung entfernen
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-slate-600 dark:text-slate-400">
              Möchten Sie diese Fahrzeug-Zuweisung wirklich entfernen? Diese Aktion kann nicht rückgängig gemacht werden.
            </p>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={handleRemoveCancel}
                className="rounded-lg border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 dark:text-white"
              >
                Abbrechen
              </Button>
              <Button
                variant="destructive"
                onClick={handleRemoveConfirm}
                className="bg-red-600 hover:bg-red-700 text-white rounded-lg"
              >
                Entfernen
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="mt-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fahrzeugtyp</TableHead>
              <TableHead>Kennzeichen</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Mitarbeiter</TableHead>
              <TableHead className="w-[100px]">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(localVehiclesByDay?.[selectedDate] || []).map(vehicle => {
              // Finde das vollständige Fahrzeug-Objekt für Status-Berechnung
              const fullVehicle = vehicles.find(v => v.id === vehicle.id);
              const statusInfo = fullVehicle ? getVehicleStatus(fullVehicle, [project], selectedDate) : null;
              
              return (
                <TableRow key={`${selectedDate}-${vehicle.id}`}>
                  <TableCell>{vehicle.type}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono rounded-lg">
                      {vehicle.licensePlate}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {statusInfo && (
                      <Badge 
                        variant="default" 
                        className={`${statusInfo.color} rounded-lg`}
                        title={statusInfo.message}
                      >
                        {statusInfo.message}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{vehicle['mitarbeiterName'] || '-'}</TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mr-2"
                      onClick={() => handleEditClick(selectedDate, vehicle)}
                    >
                      Bearbeiten
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleRemoveClick(selectedDate, vehicle.id)}
                    >
                      Entfernen
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
} 