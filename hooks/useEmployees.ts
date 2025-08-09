'use client';
import { useState, useEffect } from 'react'
import { fetchWithIntent } from '@/lib/http/fetchWithIntent'
import { EmployeesApi } from '@/lib/api/employees'
import type { Employee, VacationDay, EmployeeStatus } from '../types/main'
import { logEmployeeAction } from '../lib/clientActivityLogger'

export function useEmployees() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchEmployees() {
      setLoading(true)
      try {
        const data = await EmployeesApi.list()
        if ((data as any).success && (data as any).employees) {
          setEmployees(data.employees.map((e: any) => ({
            ...e,
            id: e._id || e.id,
            status: e.status || 'aktiv',
            vacationDays: e.vacationDays || []
          })))
        } else {
          throw new Error((data as any).message || 'Fehler beim Laden der Mitarbeiter')
        }
        setError(null)
      } catch (err: any) {
        setError(err.message)
      }
      setLoading(false)
    }
    fetchEmployees()

    // Event listener für neue Mitarbeiter
    const handleEmployeeAdded = (event: CustomEvent) => {
      const newEmployee = {
        ...event.detail,
        id: event.detail._id || event.detail.id,
        status: event.detail.status || 'aktiv',
        vacationDays: event.detail.vacationDays || []
      };
      setEmployees(prev => [...prev, newEmployee]);
    };

    window.addEventListener('employeeAdded', handleEmployeeAdded as EventListener);

    return () => {
      window.removeEventListener('employeeAdded', handleEmployeeAdded as EventListener);
    };
  }, [])

  const addEmployee = async (employeeData: Partial<Employee>) => {
    // Stelle sicher, dass der Status gesetzt ist
    if (!employeeData.status) {
      employeeData.status = 'aktiv';
    }
    
    console.log('Sende Mitarbeiterdaten an API:', employeeData);
    
    const data = await EmployeesApi.create(employeeData)
    if ((data as any).success && (data as any).data) {
      // Stelle sicher, dass der Status im lokalen State korrekt gesetzt ist
      const newEmployee = { 
        ...(data as any).data, 
        id: (data as any).data._id || (data as any).data.id,
        status: (data as any).data.status || employeeData.status || 'aktiv',
        vacationDays: (data as any).data.vacationDays || []
      };
      setEmployees(prev => [...prev, newEmployee]);
      
      // Activity Log
      try {
        await logEmployeeAction(
          'employee_created',
          `Mitarbeiter "${employeeData.name}" angelegt`,
          newEmployee.id,
          undefined,
          newEmployee
        );
      } catch (error) {
        console.error('Error logging employee creation:', error);
      }
      
      return newEmployee;
    } else {
      throw new Error(((data as any).message) || 'Fehler beim Anlegen des Mitarbeiters')
    }
  }

  const updateEmployee = async (id: string, updatedData: Partial<Employee>) => {
    const data = await EmployeesApi.update(id, updatedData)
    if ((data as any).success && (data as any).employee) {
      // Verwende die aktualisierten Daten von der API
      const updatedEmployee = {
        ...(data as any).employee,
        id: (data as any).employee._id || (data as any).employee.id,
        vacationDays: (data as any).employee.vacationDays || []
      };
      setEmployees(prev => prev.map(emp => emp.id === id ? updatedEmployee : emp))
    } else {
      throw new Error(((data as any).message) || 'Fehler beim Aktualisieren des Mitarbeiters')
    }
  }

  const deleteEmployee = async (id: string) => {
    const data = await EmployeesApi.remove(id)
    if ((data as any).success) {
      setEmployees(prev => prev.filter(emp => emp.id !== id))
    } else {
      throw new Error((data as any).message || 'Fehler beim Löschen des Mitarbeiters')
    }
  }

  const setEmployeeStatus = async (id: string, status: EmployeeStatus) => {
    const data = await EmployeesApi.update(id, { status })
    if ((data as any).success) {
      const employee = employees.find(emp => emp.id === id);
      const oldStatus = employee?.status || 'unbekannt';
      
      setEmployees(prev => prev.map(emp => emp.id === id ? { ...emp, status } : emp));
      
      // Activity Log
      try {
        await logEmployeeAction(
          'employee_status_changed',
          `Status von "${employee?.name}" von "${oldStatus}" auf "${status}" geändert`,
          id,
          { status: oldStatus },
          { status }
        );
      } catch (error) {
        console.error('Error logging status change:', error);
      }
    } else {
      throw new Error(((data as any).message) || 'Fehler beim Aktualisieren des Status');
    }
  };

  // Neue Funktion zum Hinzufügen von Urlaubszeiten
  const addVacationDay = async (employeeId: string, vacation: VacationDay) => {
    try {
      const employee = employees.find(emp => emp.id === employeeId);
      if (!employee) throw new Error('Mitarbeiter nicht gefunden');
      
      // Stelle sicher, dass die Datums-Strings vollständig sind
      const processedVacation = {
        ...vacation,
        startDate: new Date(vacation.startDate).toISOString(),
        endDate: new Date(vacation.endDate).toISOString()
      };
      
      console.log('Hinzufügen von Urlaub:', processedVacation);
      
      const updatedVacationDays = [...(employee.vacationDays || []), processedVacation];
      
      // Prüfe, ob der neue Urlaub aktiv ist
      const isNewVacationActive = isCurrentlyOnVacation(processedVacation);
      const hasActiveVacations = isNewVacationActive || isEmployeeOnVacation(employee, updatedVacationDays);
      
      // Bestimme den neuen Status basierend auf aktiven Urlaubszeiten
      const newStatus: EmployeeStatus = hasActiveVacations ? 'urlaub' : 'aktiv';
      
      console.log(`Neuer Status für ${employee.name}: ${newStatus}`);
      
      const data = await EmployeesApi.update(employeeId, { vacationDays: updatedVacationDays, status: newStatus })
      if ((data as any).success && (data as any).employee) {
        // Verwende die aktualisierten Daten von der API
        const updatedEmployee = {
          ...(data as any).employee,
          id: (data as any).employee._id || (data as any).employee.id,
          vacationDays: (data as any).employee.vacationDays || []
        };
        
        setEmployees(prev => prev.map(emp => 
          emp.id === employeeId ? updatedEmployee : emp
        ));
        
        // Activity Log
        try {
          await logEmployeeAction(
            'employee_vacation_added',
            `Urlaubszeit für "${employee.name}" hinzugefügt: ${new Date(vacation.startDate).toLocaleDateString('de-DE')} - ${new Date(vacation.endDate).toLocaleDateString('de-DE')}`,
            employeeId,
            employee.vacationDays,
            updatedVacationDays
          );
        } catch (error) {
          console.error('Error logging vacation addition:', error);
        }
        
        return true;
      } else {
        throw new Error(((data as any).message) || 'Fehler beim Speichern der Urlaubszeiten');
      }
    } catch (error: any) {
      console.error('Fehler beim Hinzufügen von Urlaub:', error);
      throw error;
    }
  };

  // Funktion zum Löschen von Urlaubszeiten
  const deleteVacationDay = async (employeeId: string, vacationId: string) => {
    try {
      const employee = employees.find(emp => emp.id === employeeId);
      if (!employee || !employee.vacationDays) throw new Error('Mitarbeiter oder Urlaub nicht gefunden');
      
      const updatedVacationDays = employee.vacationDays.filter(vac => vac.id !== vacationId);
      
      // Prüfe, ob noch aktive Urlaubszeiten vorhanden sind
      const hasActiveVacations = isEmployeeOnVacation(employee, updatedVacationDays);
      
      // Bestimme den neuen Status basierend auf aktiven Urlaubszeiten
      const newStatus: EmployeeStatus = hasActiveVacations ? 'urlaub' : 'aktiv';
      
      const data = await EmployeesApi.update(employeeId, { vacationDays: updatedVacationDays, status: newStatus })
      if ((data as any).success && (data as any).employee) {
        // Verwende die aktualisierten Daten von der API
        const updatedEmployee = {
          ...(data as any).employee,
          id: (data as any).employee._id || (data as any).employee.id,
          vacationDays: (data as any).employee.vacationDays || []
        };
        
        setEmployees(prev => prev.map(emp => 
          emp.id === employeeId ? updatedEmployee : emp
        ));
        return true;
      } else {
        throw new Error(((data as any).message) || 'Fehler beim Löschen der Urlaubszeiten');
      }
    } catch (error: any) {
      console.error('Fehler beim Löschen von Urlaub:', error);
      throw error;
    }
  };

  // Neue Funktion: Aktualisiere Status basierend auf Urlaubszeiten
  const updateEmployeeStatusBasedOnVacation = async (employeeId: string) => {
    try {
      const employee = employees.find(emp => emp.id === employeeId);
      if (!employee) throw new Error('Mitarbeiter nicht gefunden');
      
      const hasActiveVacations = isEmployeeOnVacation(employee);
      const newStatus: EmployeeStatus = hasActiveVacations ? 'urlaub' : 'aktiv';
      
      // Nur aktualisieren, wenn sich der Status ändert
      if (employee.status !== newStatus) {
        const data = await EmployeesApi.update(employeeId, { status: newStatus })
        if ((data as any).success) {
          setEmployees(prev => prev.map(emp => 
            emp.id === employeeId ? { ...emp, status: newStatus } : emp
          ));
          return true;
        }
      }
      return false;
    } catch (error: any) {
      console.error('Fehler beim Aktualisieren des Status basierend auf Urlaub:', error);
      throw error;
    }
  };

  // Neue Funktion: Automatische Status-Anpassung für alle Mitarbeiter
  const updateAllEmployeeStatusesBasedOnVacation = async () => {
    try {
      const today = new Date();
      let updatedCount = 0;

      console.log('=== AUTOMATISCHE STATUS-ANPASSUNG STARTET ===');
      console.log('Aktuelles Datum:', today.toISOString());
      console.log('Anzahl Mitarbeiter:', employees.length);

      for (const employee of employees) {
        console.log(`\nPrüfe Mitarbeiter: ${employee.name}`);
        console.log(`Aktueller Status: ${employee.status}`);
        console.log(`Urlaubszeiten:`, employee.vacationDays);
        
        const isOnVacation = isEmployeeOnVacation(employee, employee.vacationDays || [], today);
        const shouldBeOnVacation = isOnVacation && employee.status !== 'urlaub';
        const shouldBeActive = !isOnVacation && employee.status === 'urlaub';

        console.log(`Ist im Urlaub: ${isOnVacation}`);
        console.log(`Sollte auf Urlaub gesetzt werden: ${shouldBeOnVacation}`);
        console.log(`Sollte auf Aktiv gesetzt werden: ${shouldBeActive}`);

        if (shouldBeOnVacation || shouldBeActive) {
          const newStatus: EmployeeStatus = isOnVacation ? 'urlaub' : 'aktiv';
          console.log(`Setze Status auf: ${newStatus}`);
          
          const data = await EmployeesApi.update(employee.id, { status: newStatus })
          if ((data as any).success !== false) {
            setEmployees(prev => prev.map(emp => 
              emp.id === employee.id ? { ...emp, status: newStatus } : emp
            ));
            updatedCount++;
            console.log(`✅ Status für ${employee.name} aktualisiert`);
          } else {
            console.log(`❌ Fehler beim Aktualisieren von ${employee.name}`);
          }
        } else {
          console.log(`⏭️ Keine Änderung für ${employee.name} nötig`);
        }
      }

      console.log(`\n${updatedCount} Mitarbeiter-Status basierend auf Urlaubszeiten aktualisiert`);
      console.log('=== AUTOMATISCHE STATUS-ANPASSUNG BEENDET ===');
      return updatedCount;
    } catch (error: any) {
      console.error('Fehler beim automatischen Aktualisieren der Status:', error);
      throw error;
    }
  };

  // Hilfsfunktion: Prüft, ob ein Mitarbeiter aktuell im Urlaub ist
  const isCurrentlyOnVacation = (vacation: VacationDay) => {
    const today = new Date();
    const startDate = new Date(vacation.startDate);
    const endDate = new Date(vacation.endDate);
    
    console.log('isCurrentlyOnVacation Check:');
    console.log('  Heute:', today.toISOString());
    console.log('  Start:', startDate.toISOString());
    console.log('  Ende:', endDate.toISOString());
    console.log('  Ist im Urlaub:', today >= startDate && today <= endDate);
    
    return today >= startDate && today <= endDate;
  };

  // Hilfsfunktion: Prüft, ob ein Mitarbeiter mit seinen Urlaubszeiten aktuell im Urlaub ist
  const isEmployeeOnVacation = (employee: Employee, vacationDays = employee.vacationDays || [], checkDate?: Date) => {
    const dateToCheck = checkDate || new Date();
    console.log(`isEmployeeOnVacation Check für ${employee.name}:`);
    console.log('  Datum zu prüfen:', dateToCheck.toISOString());
    console.log('  Anzahl Urlaubszeiten:', vacationDays.length);
    
    const isOnVacation = vacationDays.some(vacation => {
      const startDate = new Date(vacation.startDate);
      const endDate = new Date(vacation.endDate);
      const isCurrentlyOnVacation = dateToCheck >= startDate && dateToCheck <= endDate;
      
      console.log(`  Urlaub: ${startDate.toISOString()} - ${endDate.toISOString()}`);
      console.log(`  Ist im Urlaub: ${isCurrentlyOnVacation}`);
      
      return isCurrentlyOnVacation;
    });
    
    console.log(`  Gesamtergebnis für ${employee.name}: ${isOnVacation}`);
    return isOnVacation;
  };

  // Hilfsfunktion: Prüft, ob ein Mitarbeiter an einem bestimmten Datum im Urlaub ist
  const isEmployeeOnVacationOnDate = (employee: Employee, date: Date) => {
    if (!employee.vacationDays || employee.vacationDays.length === 0) return false;
    
    return employee.vacationDays.some(vacation => {
      const startDate = new Date(vacation.startDate);
      const endDate = new Date(vacation.endDate);
      return date >= startDate && date <= endDate;
    });
  };

  // Neue Funktion: Prüft, ob ein Mitarbeiter während eines Zeitraums im Urlaub ist
  const isEmployeeOnVacationDuringPeriod = (employee: Employee, startDate: Date, endDate: Date) => {
    if (!employee.vacationDays || employee.vacationDays.length === 0) return false;
    
    return employee.vacationDays.some(vacation => {
      const vacationStart = new Date(vacation.startDate);
      const vacationEnd = new Date(vacation.endDate);
      
      // Prüfe, ob sich die Zeiträume überschneiden
      return vacationStart <= endDate && vacationEnd >= startDate;
    });
  };

  return { 
    employees, 
    loading, 
    error, 
    addEmployee, 
    updateEmployee, 
    deleteEmployee, 
    setEmployeeStatus,
    addVacationDay,
    deleteVacationDay,
    updateEmployeeStatusBasedOnVacation,
    updateAllEmployeeStatusesBasedOnVacation,
    isEmployeeOnVacation,
    isEmployeeOnVacationOnDate,
    isEmployeeOnVacationDuringPeriod
  }
} 