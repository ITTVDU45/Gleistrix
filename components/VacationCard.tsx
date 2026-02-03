"use client";
import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Calendar, Trash2, Plus, CheckCircle2, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader } from './ui/card';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';
import { useEmployees } from '../hooks/useEmployees';
import type { Employee, VacationDay } from '../types/main';
import { v4 as uuidv4 } from 'uuid';

// Einfache Textarea-Komponente inline definieren
const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={`flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${className || ''}`}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

interface VacationCardProps {
  employee: Employee;
  onVacationChange?: (isOnVacation: boolean) => void;
}

export default function VacationCard({ employee, onVacationChange }: VacationCardProps) {
  const { addVacationDay, deleteVacationDay, isEmployeeOnVacation, updateEmployeeStatusBasedOnVacation } = useEmployees();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [currentEmployee, setCurrentEmployee] = useState<Employee>(employee);
  const [formData, setFormData] = useState<Omit<VacationDay, 'id'>>({
    startDate: '',
    endDate: '',
    reason: '',
    approved: true
  });

  // Lade die aktuellen Mitarbeiterdaten von der API
  const fetchCurrentEmployee = async () => {
    try {
      const { EmployeesApi } = await import('@/lib/api/employees')
      const data = await EmployeesApi.get(employee.id)
      const normalized: any = data?.employee || data
      if (normalized) {
        const updatedEmployee = {
          ...normalized,
          id: (normalized as any)._id || (normalized as any).id,
          vacationDays: (normalized as any).vacationDays || []
        } as Employee
        setCurrentEmployee(updatedEmployee)
      }
    } catch (error) {
      console.error('Fehler beim Laden der aktuellen Mitarbeiterdaten:', error);
    }
  };

  // Lade die Daten beim ersten Laden und nach Änderungen
  useEffect(() => {
    fetchCurrentEmployee();
  }, [employee.id]);

  const isOnVacation = isEmployeeOnVacation(currentEmployee);
  
  // Wenn der Mitarbeiter-Urlaubsstatus sich ändert, teile es dem Parent mit
  useEffect(() => {
    if (onVacationChange) {
      onVacationChange(isOnVacation);
    }
  }, [isOnVacation, onVacationChange]);

  const handleInputChange = (field: keyof typeof formData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateForm = () => {
    const startDate = new Date(formData.startDate);
    const endDate = new Date(formData.endDate);
    
    if (!formData.startDate) {
      setError('Bitte geben Sie ein Startdatum ein');
      return false;
    }
    
    if (!formData.endDate) {
      setError('Bitte geben Sie ein Enddatum ein');
      return false;
    }
    
    if (startDate > endDate) {
      setError('Das Startdatum kann nicht nach dem Enddatum liegen');
      return false;
    }
    
    return true;
  };

  const handleSubmit = async () => {
    setError(null);
    setLoading(true);
    
    if (!validateForm()) {
      setLoading(false);
      return;
    }
    
    try {
      const vacationData: VacationDay = {
        ...formData,
        id: uuidv4() // Generiere eine eindeutige ID für den neuen Urlaub
      };
      
      await addVacationDay(employee.id, vacationData);
      
      // Lade die aktuellen Daten neu
      await fetchCurrentEmployee();
      
      // Aktualisiere den Status basierend auf Urlaubszeiten
      await updateEmployeeStatusBasedOnVacation(employee.id);
      
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setIsModalOpen(false);
      }, 1500);
      
      // Zurücksetzen des Formulars
      setFormData({
        startDate: '',
        endDate: '',
        reason: '',
        approved: true
      });
    } catch (err: any) {
      setError(err.message || 'Fehler beim Speichern des Urlaubs');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (vacationId: string) => {
    setIsDeleting(true);
    try {
      await deleteVacationDay(employee.id, vacationId);
      
      // Lade die aktuellen Daten neu
      await fetchCurrentEmployee();
      
      // Aktualisiere den Status basierend auf Urlaubszeiten
      await updateEmployeeStatusBasedOnVacation(employee.id);
      
      setSuccess(true);
      setTimeout(() => setSuccess(false), 1500);
    } catch (err: any) {
      setError(err.message || 'Fehler beim Löschen des Urlaubs');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Card className="border-0 shadow-lg bg-white dark:bg-slate-800 rounded-xl">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center">
          <Calendar className="mr-2 h-5 w-5 text-blue-600 dark:text-blue-400" />
          Urlaubszeiten
        </h2>
        <Button 
          onClick={() => setIsModalOpen(true)} 
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl flex items-center"
          size="sm"
        >
          <Plus className="mr-1 h-4 w-4" />
          Urlaub eintragen
        </Button>
      </CardHeader>
      <CardContent>
        {success && (
          <Alert className="mb-4 border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800 rounded-xl">
            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
            <AlertDescription className="text-green-800 dark:text-green-200">
              Vorgang erfolgreich durchgeführt
            </AlertDescription>
          </Alert>
        )}
        
        {error && (
          <Alert className="mb-4 border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 rounded-xl">
            <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
            <AlertDescription className="text-red-800 dark:text-red-200">
              {error}
            </AlertDescription>
          </Alert>
        )}
        
        {!currentEmployee.vacationDays || currentEmployee.vacationDays.length === 0 ? (
          <div className="text-center py-8">
            <Calendar className="mx-auto h-10 w-10 text-slate-400 dark:text-slate-500" />
            <p className="mt-2 text-slate-600 dark:text-slate-400">
              Keine Urlaubszeiten eingetragen
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {currentEmployee.vacationDays.map((vacation, index) => {
              const startDate = new Date(vacation.startDate);
              const endDate = new Date(vacation.endDate);
              const isActive = isOnVacation && 
                new Date() >= startDate && 
                new Date() <= endDate;
              
              // Erstelle einen eindeutigen Key
              const uniqueKey = vacation.id || `vacation-${index}-${startDate.getTime()}-${endDate.getTime()}`;
              
              return (
                <div 
                  key={uniqueKey} 
                  className={`flex items-center justify-between p-3 border rounded-lg ${
                    isActive 
                      ? 'border-yellow-300 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-700'
                      : 'border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <div className="flex flex-col">
                    <div className="flex items-center">
                      <span className="font-medium text-slate-900 dark:text-white">
                        {format(startDate, 'dd. MMMM yyyy', { locale: de })}
                      </span>
                      <span className="mx-2 text-slate-600 dark:text-slate-400">bis</span>
                      <span className="font-medium text-slate-900 dark:text-white">
                        {format(endDate, 'dd. MMMM yyyy', { locale: de })}
                      </span>
                    </div>
                    {vacation.reason && (
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                        {vacation.reason}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center">
                    {isActive && (
                      <Badge className="mr-2 bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                        Aktiv
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(vacation.id!)}
                      disabled={isDeleting}
                      className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* Urlaub-Eintragen-Dialog */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md rounded-xl bg-white dark:bg-slate-800">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
              <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              Urlaub eintragen
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="startDate">Von</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={formData.startDate.toString()}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('startDate', e.target.value)}
                  className="mt-1 rounded-xl border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-white"
                />
              </div>
              <div>
                <Label htmlFor="endDate">Bis</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={formData.endDate.toString()}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('endDate', e.target.value)}
                  className="mt-1 rounded-xl border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-white"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="reason">Grund (optional)</Label>
              <Textarea
                id="reason"
                value={formData.reason || ''}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleInputChange('reason', e.target.value)}
                placeholder="Grund für den Urlaub"
                className="mt-1 rounded-xl min-h-[80px] border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-white"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsModalOpen(false)}
              disabled={loading}
              className="rounded-lg border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 dark:text-white"
            >
              Abbrechen
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
            >
              {loading ? 'Speichern...' : 'Speichern'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
} 