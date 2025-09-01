"use client";
import React, { useEffect, useMemo, useState } from 'react'
import { Input } from './ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Button } from './ui/button'
import { Checkbox } from './ui/checkbox'
import { Label } from './ui/label'
import type { Project, TimeEntry, MitarbeiterFunktion, Employee } from '../types'
import { format, parseISO, addDays } from 'date-fns'
import { de } from 'date-fns/locale'
import { useProjects } from '../hooks/useProjects'
import { Alert } from './ui/alert'
import { AlertCircle } from 'lucide-react'
import MultiSelectDropdown from './ui/MultiSelectDropdown';
import { useEmployees } from '../hooks/useEmployees';

// TimeEntry-Typ lokal erweitern, damit sonntagsstunden erlaubt ist
type TimeEntryWithSunday = import('../types').TimeEntry & { sonntagsstunden?: number };

interface TimeEntryFormProps {
  project: Project
  selectedDate: string
  onAdd: (dates: string[] | string, entry: TimeEntry) => void
  onClose: () => void
  employees?: Employee[]
  initialEntry?: Partial<TimeEntry>
  hasExistingTimeEntries?: boolean
}

export function TimeEntryForm({ project, selectedDate, onAdd, onClose, employees = [], initialEntry, hasExistingTimeEntries = false }: TimeEntryFormProps) {
  const { isEmployeeOnVacationDuringPeriod } = useEmployees();
  const [formData, setFormData] = React.useState({
    name: initialEntry?.name || '',
    funktion: (initialEntry?.funktion as MitarbeiterFunktion) || '',
    start: initialEntry?.start || '',
    ende: initialEntry?.ende || '',
    pause: initialEntry?.pause || '',
    extra: initialEntry?.extra?.toString() || '',
    fahrtstunden: initialEntry?.fahrtstunden?.toString() || '',
    feiertag: !!initialEntry?.feiertag,
    sonntag: !!initialEntry?.sonntag,
    bemerkung: initialEntry?.bemerkung || ''
  })

  // Wenn initialEntry sich ändert (z.B. beim Bearbeiten), setze die Formulardaten neu
  React.useEffect(() => {
    if (initialEntry) {
      setFormData({
        name: initialEntry.name || '',
        funktion: (initialEntry.funktion as MitarbeiterFunktion) || '',
        start: initialEntry.start || '',
        ende: initialEntry.ende || '',
        pause: initialEntry.pause || '',
        extra: initialEntry.extra?.toString() || '',
        fahrtstunden: initialEntry.fahrtstunden?.toString() || '',
        feiertag: !!initialEntry.feiertag,
        sonntag: !!initialEntry.sonntag,
        bemerkung: initialEntry.bemerkung || ''
      });
    }
  }, [initialEntry]);

  // Pausenoptionen 0, 0.25, 0.5, 0.75, ... 12 (0.25 Schritte)
  const pauseOptions = useMemo(() => {
    const options: string[] = [];
    // 12 / 0.25 = 48 steps
    for (let i = 0; i <= 48; i++) {
      const val = +(i * 0.25).toFixed(2);
      // Keep compact string (e.g. '1' instead of '1.00')
      options.push(Number.isInteger(val) ? val.toString() : val.toString());
    }
    return options;
  }, []);

  // Funktionen des gewählten Mitarbeiters
  const selectedEmployee = employees.find(e => e.name === formData.name);
  const employeeFunctions = selectedEmployee?.position?.split(',').map(f => f.trim()).filter(Boolean) || [];

  // Alle Zeiteinträge an diesem Tag (aus allen Projekten, falls übergeben)
  const allEntriesForDate = useMemo(() => {
    if (!selectedDate) return [];
    return Object.values(project.mitarbeiterZeiten?.[selectedDate] || []);
  }, [project, selectedDate]);

  const { projects: allProjects } = useProjects();
  const [apiError, setApiError] = useState<string | null>(null)

  function isEmployeeAssignedElsewhere(employeeName: string, day: string, currentProjectId: string, projects: Project[]): boolean {
    return projects.some(p => {
      if (p.id === currentProjectId) return false;
      if (!p.mitarbeiterZeiten || !p.mitarbeiterZeiten[day]) return false;
      return p.mitarbeiterZeiten[day].some((entry: any) => entry.name === employeeName);
    });
  }

  // Prüfe, ob ein Mitarbeiter an diesem Tag und Zeitraum bereits einen Eintrag hat
  function isEmployeeBlocked(employee: Employee) {
    if (!formData.start || !formData.ende) return false;
    const start = formData.start;
    const ende = formData.ende;
    return allEntriesForDate.some((entry: any) => {
      if (entry.name !== employee.name) return false;
      // Zeitüberschneidung prüfen
      const entryStart = entry.start;
      const entryEnd = entry.ende;
      return (
        (start < entryEnd && ende > entryStart)
      );
    });
  }

  // Projekttage berechnen
  const projectDays = useMemo(() => {
    const startDate = parseISO(project.datumBeginn)
    const endDate = parseISO(project.datumEnde)
    const days: string[] = []
    let currentDate = startDate
    while (currentDate <= endDate) {
      days.push(format(currentDate, 'yyyy-MM-dd'))
      currentDate = addDays(currentDate, 1)
    }
    return days
  }, [project.datumBeginn, project.datumEnde])

  // Filtere Mitarbeiter basierend auf Urlaubsstatus während der Projektzeit
  const availableEmployees = useMemo(() => {
    // Zeige alle Mitarbeiter an - die Filterung erfolgt bei der Tag-Auswahl
    return employees;
  }, [employees]);

  // Neue Funktion: Prüft, ob ein Mitarbeiter an einem spezifischen Tag im Urlaub ist
  const isEmployeeOnVacationOnDay = (employee: any, day: string) => {
    if (!employee.vacationDays || employee.vacationDays.length === 0) return false;
    
    const checkDate = parseISO(day);
    return employee.vacationDays.some((vacation: any) => {
      const startDate = new Date(vacation.startDate);
      const endDate = new Date(vacation.endDate);
      return checkDate >= startDate && checkDate <= endDate;
    });
  };

  const [selectedDays, setSelectedDays] = useState<string[]>(selectedDate ? [selectedDate] : [])
  const [selectAllDays, setSelectAllDays] = useState(false)
  const [isMultiDay, setIsMultiDay] = useState(false)
  const [showHolidayDropdown, setShowHolidayDropdown] = useState(false)
  const [selectedHolidayDays, setSelectedHolidayDays] = useState<string[]>([])

  // Alle Tage auswählen
  const handleSelectAllDays = (checked: boolean) => {
    setSelectAllDays(checked)
    if (checked) {
      // Wähle nur Tage aus, an denen der ausgewählte Mitarbeiter nicht im Urlaub ist
      const availableDays = projectDays.filter(day => {
        if (selectedEmployees.length === 0) return false;
        
        // Prüfe, ob der Mitarbeiter an diesem Tag im Urlaub ist
        const isOnVacation = selectedEmployees.some(employeeName => {
          const employee = availableEmployees.find(e => e.name === employeeName);
          return employee && isEmployeeOnVacationOnDay(employee, day);
        });
        
        // Prüfe, ob der Tag bereits belegt ist (für alle ausgewählten Mitarbeiter)
        const isAssignedElsewhere = selectedEmployees.some(employeeName => 
          isEmployeeAssignedElsewhere(employeeName, day, project.id, allProjects)
        );
        
        return !isOnVacation && !isAssignedElsewhere;
      });
      
      setSelectedDays(availableDays);
    } else {
      setSelectedDays([])
    }
  }

  // Einzelnen Tag toggeln
  const handleDayToggle = (day: string) => {
    setSelectedDays(prev => {
      const newSelected = prev.includes(day)
        ? prev.filter(d => d !== day)
        : [...prev, day]
      
      // Prüfe, ob alle verfügbaren Tage ausgewählt sind
      const availableDays = projectDays.filter(day => {
        if (selectedEmployees.length === 0) return false;
        
        const isOnVacation = selectedEmployees.some(employeeName => {
          const employee = availableEmployees.find(e => e.name === employeeName);
          return employee && isEmployeeOnVacationOnDay(employee, day);
        });
        
        const isAssignedElsewhere = selectedEmployees.some(employeeName => 
          isEmployeeAssignedElsewhere(employeeName, day, project.id, allProjects)
        );
        
        return !isOnVacation && !isAssignedElsewhere;
      });
      
      setSelectAllDays(newSelected.length === availableDays.length && availableDays.length > 0);
      return newSelected
    })
  }

  // State für Kopierfunktion
  const [copyMode, setCopyMode] = useState(false);
  const [selectedCopyEntry, setSelectedCopyEntry] = useState<any | null>(null);

  // Label für aktuell ausgewählten Eintrag im Zeiten-kopieren-Select
  const selectedCopyEntryLabel = selectedCopyEntry
    ? `${selectedCopyEntry.name} | ${selectedCopyEntry.funktion} | ${selectedCopyEntry.day} | ${selectedCopyEntry.start} - ${selectedCopyEntry.ende}`
    : '';

  // Hilfsfunktion für Label eines Eintrags
  const getEntryLabel = (e: any) =>
    `${e.name} | ${e.funktion} | ${format(parseISO(e.day), 'dd.MM', { locale: de })} | ${e.start.slice(11, 16)} - ${e.ende.slice(11, 16)}`;

  // Hilfsfunktion für den Wert eines Eintrags
  const getEntryValue = (e: any) => `${e.id}-${e.day}`;

  // Alle bisherigen Zeiteinträge anderer Mitarbeiter (außer aktuell bearbeiteten, aber NICHT nach formData.name filtern)
  const allOtherEntries = useMemo(() => {
    const entries: any[] = [];
    Object.entries(project.mitarbeiterZeiten || {}).forEach(([day, arr]: any) => {
      (arr || []).forEach((entry: any) => {
        // Optional: Wenn du den aktuell bearbeiteten Eintrag (z.B. beim Editieren) ausschließen willst, prüfe auf initialEntry.id
        if (!initialEntry || entry.id !== initialEntry.id || entry.day !== selectedDate) {
          entries.push({ ...entry, day });
        }
      });
    });
    return entries;
  }, [project.mitarbeiterZeiten, initialEntry, selectedDate]);

  // Wenn ein Eintrag ausgewählt wird, übernehme NUR Zeiten, lasse Name, Funktion und Tage unverändert
  useEffect(() => {
    if (selectedCopyEntry) {
      // Prüfe, ob der kopierte Eintrag tagübergreifend ist
      const startDate = new Date(selectedCopyEntry.start);
      const endDate = new Date(selectedCopyEntry.ende);
      const isCrossDay = startDate.toDateString() !== endDate.toDateString();
      
      // Wenn tagübergreifend, aktiviere den Multi-Day-Modus
      if (isCrossDay) {
        setIsMultiDay(true);
      }
      
      setFormData(prev => ({
        ...prev,
        start: selectedCopyEntry.start,
        ende: selectedCopyEntry.ende,
        pause: selectedCopyEntry.pause,
        fahrtstunden: selectedCopyEntry.fahrtstunden?.toString() || '',
        // Name, Funktion und Tage bleiben erhalten
      }));
      // selectedDays NICHT automatisch setzen!
    }
  }, [selectedCopyEntry]);

  // Setze selectedCopyEntry auf null, wenn sich der Mitarbeiter ändert
  useEffect(() => {
    setSelectedCopyEntry(null);
  }, [formData.name]);

  // 1. Berechne belegte Tage für den aktuell gewählten Mitarbeiter (projektübergreifend)
  const belegteTage = useMemo(() => {
    if (!formData.name) return [];
    const tage: string[] = [];
    allProjects.forEach(p => {
      Object.entries(p.mitarbeiterZeiten || {}).forEach(([day, arr]: any) => {
        if ((arr || []).some((entry: any) => entry.name === formData.name)) {
          tage.push(day);
        }
      });
    });
    return tage;
  }, [allProjects, formData.name]);

  // Initial States
  const [startDay, setStartDay] = useState(selectedDate || selectedDays[0] || '');
  const [startTime, setStartTime] = useState(formData.start || '');
  const [endDay, setEndDay] = useState(selectedDate || selectedDays[0] || '');
  const [endTime, setEndTime] = useState(formData.ende || '');

  // Entferne die Validierung für Endzeit-Tag und die Einschränkung der Tag-Auswahl
  // Die folgenden useEffect- und Variablen für belegteTage, freieTage, endDayError, endDayOptions werden entfernt oder ignoriert

  // Wenn sich selectedDate ändert, aktualisiere Start- und Endtag (nur bei nicht-tagübergreifenden Einträgen)
  useEffect(() => {
    if (!isMultiDay && selectedDate) {
      setStartDay(selectedDate);
      setEndDay(selectedDate);
    }
  }, [selectedDate, isMultiDay]);

  // Freie Tage für den Mitarbeiter (projektübergreifend, wie bisher)
  const freieTage = useMemo(() => {
    if (!formData.name) return [];
    return projectDays.filter(day => !belegteTage.includes(day));
  }, [projectDays, belegteTage, formData.name]);

  // Endzeit-Tag darf nicht gewählt werden, wenn der Mitarbeiter an diesem Tag schon einen Eintrag hat
  const endDayOptions = freieTage.includes(startDay)
    ? [...freieTage, startDay].filter((v, i, arr) => arr.indexOf(v) === i) // Starttag immer erlauben
    : freieTage;

  // 2. Filtere allOtherEntries für das Dropdown „Zeiten kopieren“
  const kopierbareEintraege = useMemo(() => {
    return allOtherEntries.filter(e => !belegteTage.includes(e.day));
  }, [allOtherEntries, belegteTage]);

  // Hilfsfunktion: Berechne Stunden zwischen zwei Zeitpunkten (inkl. Datum, auch über Mitternacht, in lokaler Zeit)
  function calculateHoursForDay(startISO: string, endISO: string): number {
    const startDate = new Date(startISO);
    const endDate = new Date(endISO);
    return (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
  }

  // Hilfsfunktion für Nachtzulage (23:00-06:00), arbeitet mit ISO-Strings in lokaler Zeit und zieht Pause ab
  function calculateNightBonus(startISO: string, endISO: string, pause: string): number {
    const startDate = new Date(startISO);
    const endDate = new Date(endISO);
    let totalNightMinutes = 0;
    let current = new Date(startDate);
    while (current < endDate) {
      const hour = current.getHours();
      const minute = current.getMinutes();
      const minutesOfDay = hour * 60 + minute;
      // Nachtzeit: 23:00-24:00 oder 0:00-6:00
      if (minutesOfDay >= 23 * 60 || minutesOfDay < 6 * 60) {
        totalNightMinutes++;
      }
      current.setMinutes(current.getMinutes() + 1);
    }
    // Pause abziehen
    const pauseNum = parseFloat((pause || '0').replace(',', '.')) || 0;
    totalNightMinutes = Math.max(0, totalNightMinutes - pauseNum * 60);
    return totalNightMinutes / 60;
  }

  // Hilfsfunktion: Berechne Sonntagsstunden für einen Zeitraum
  function calculateSundayHours(startISO: string, endISO: string): number {
    const startDate = new Date(startISO);
    const endDate = new Date(endISO);
    let totalSundayMinutes = 0;
    let current = new Date(startDate);
    while (current < endDate) {
      if (current.getDay() === 0) { // 0 = Sonntag
        totalSundayMinutes++;
      }
      current.setMinutes(current.getMinutes() + 1);
    }
    return totalSundayMinutes / 60;
  }

  // Plausibilitäts-Fehler-Message
  const [plausiError, setPlausiError] = useState<string | null>(null);

  // Automatische Anpassung des Endtags bei über Mitternacht (nur bei nicht-tagübergreifenden Einträgen)
  useEffect(() => {
    if (isMultiDay || !startDay || !endDay || !startTime || !endTime) return;
    const idx = projectDays.indexOf(startDay);
    // Wenn Endtag gleich Starttag und Endzeit < Startzeit → Endtag auf Folgetag setzen
    if (startDay === endDay && endTime < startTime) {
      if (idx !== -1 && idx + 1 < projectDays.length) {
        setEndDay(projectDays[idx + 1]);
      }
    }
    // Wenn Endtag Folgetag und Endzeit >= Startzeit → Endtag auf Starttag zurücksetzen
    if (endDay === projectDays[idx + 1] && endTime >= startTime) {
      setEndDay(startDay);
    }
  }, [startDay, endDay, startTime, endTime, projectDays, isMultiDay]);

  // Plausibilitätsprüfung für Zeitspanne (blockiere negative und 24h+ Zeiträume)
  useEffect(() => {
    if (isMultiDay || !startDay || !endDay || !startTime || !endTime) {
      setPlausiError(null);
      return;
    }
    
    // Wenn Start- und Endtag gleich sind, prüfe die Uhrzeiten
    if (startDay === endDay) {
      if (endTime <= startTime) {
        setPlausiError('Die Endzeit muss nach der Startzeit liegen.');
        return;
      }
    }
    
    const startISO = `${startDay}T${startTime}`;
    const endISO = `${endDay}T${endTime}`;
    const startDate = new Date(startISO);
    const endDate = new Date(endISO);
    const diffH = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
    
    if (diffH <= 0) {
      setPlausiError('Die Endzeit muss nach der Startzeit liegen.');
    } else if (diffH >= 24) {
      setPlausiError('Die Zeitspanne darf weniger als 24 Stunden betragen.');
    } else {
      setPlausiError(null);
    }
  }, [startDay, endDay, startTime, endTime, isMultiDay]);

  // State für Multi-Select Mitarbeiter
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>(initialEntry?.name ? [initialEntry.name] : []);

  // Aktualisiere selectAllDays, wenn sich selectedEmployees ändert
  useEffect(() => {
    if (selectedEmployees.length === 0) {
      setSelectAllDays(false);
      return;
    }
    
    // Prüfe, ob alle verfügbaren Tage ausgewählt sind
    const availableDays = projectDays.filter(day => {
      const isOnVacation = selectedEmployees.some(employeeName => {
        const employee = availableEmployees.find(e => e.name === employeeName);
        return employee && isEmployeeOnVacationOnDay(employee, day);
      });
      
      const isAssignedElsewhere = selectedEmployees.some(employeeName => 
        isEmployeeAssignedElsewhere(employeeName, day, project.id, allProjects)
      );
      
      return !isOnVacation && !isAssignedElsewhere;
    });
    
    setSelectAllDays(selectedDays.length === availableDays.length && availableDays.length > 0);
  }, [selectedEmployees, selectedDays, projectDays, availableEmployees, allProjects, project.id]);

  // Setze Start- und Endtage automatisch, wenn nicht tagübergreifend
  useEffect(() => {
    if (!isMultiDay && selectedDays.length > 0) {
      // Verwende den ersten ausgewählten Tag für Start und Ende
      const firstSelectedDay = selectedDays[0];
      setStartDay(firstSelectedDay);
      setEndDay(firstSelectedDay);
    }
  }, [isMultiDay, selectedDays]);

  // Reset selectedDays wenn copyMode aktiviert wird
  useEffect(() => {
    if (copyMode) {
      setSelectedDays([]);
      setSelectAllDays(false);
    }
  }, [copyMode]);

  // Synchronisiere selectedHolidayDays wenn sich selectedDays ändert
  useEffect(() => {
    if (showHolidayDropdown) {
      // Entferne Feiertags-Tage, die nicht mehr verfügbar sind
      setSelectedHolidayDays(prev => 
        prev.filter(holidayDay => {
          const holidayDate = holidayDay.split('.').reverse().join('-'); // Konvertiere dd.MM.yyyy zu yyyy-MM-dd
          let availableDays: string[];
          
          if (copyMode && selectedCopyEntry) {
            // Bei kopierten tagübergreifenden Einträgen: Starttag und Folgetag
            const startDate = new Date(selectedCopyEntry.start);
            const endDate = new Date(selectedCopyEntry.ende);
            const isCrossDay = startDate.toDateString() !== endDate.toDateString();
            
            if (isCrossDay) {
              // Bei tagübergreifenden Einträgen: Starttag und Folgetag
              const startDay = format(startDate, 'yyyy-MM-dd');
              const nextDay = format(addDays(startDate, 1), 'yyyy-MM-dd');
              availableDays = [startDay, nextDay];
            } else {
              // Bei eintägigen Einträgen: Nur der Tag selbst
              availableDays = [selectedCopyEntry.day];
            }
          } else {
            // Bei normalen und tagübergreifenden Einträgen: Ausgewählte Tage
            availableDays = selectedDays;
          }
          
          return availableDays.includes(holidayDate);
        })
      );
    }
  }, [selectedDays, showHolidayDropdown, copyMode, selectedCopyEntry]);

  // Wenn sich selectedDays ändert, setze den ersten freien Tag als Startzeit-Tag (nur bei nicht-tagübergreifenden Einträgen)
  useEffect(() => {
    if (!isMultiDay && selectedDays.length > 0 && formData.name) {
      // Finde den ersten Tag aus selectedDays, der nicht in belegteTage ist
      const firstFreeDay = selectedDays.find(day => !belegteTage.includes(day));
      if (firstFreeDay && firstFreeDay !== startDay) {
        setStartDay(firstFreeDay);
        // Wenn der aktuelle endDay belegt ist oder nicht gesetzt, auch endDay aktualisieren
        if (!endDay || belegteTage.includes(endDay)) {
          setEndDay(firstFreeDay);
        }
      }
    }
  }, [selectedDays, formData.name, belegteTage, isMultiDay]);

  // State für Mitarbeitersuche
  const [employeeSearch, setEmployeeSearch] = useState('');
  const filteredEmployees = availableEmployees.filter(e => e.name.toLowerCase().includes(employeeSearch.toLowerCase()));

  // Hilfsfunktion: Schnittmenge der Funktionen aller ausgewählten Mitarbeiter
  function getCommonFunctions() {
    if (selectedEmployees.length === 0) return [];
    const selected = availableEmployees.filter(e => selectedEmployees.includes(e.name));
    const allFunctions = selected.map(e =>
      (e.position || '').split(',').map(f => f.trim()).filter(Boolean)
    );
    if (allFunctions.length === 0) return [];
    // Schnittmenge berechnen
    return allFunctions.reduce((a, b) => a.filter(f => b.includes(f)));
  }
  const commonFunctions = getCommonFunctions();

  // Hilfsfunktion: Sind alle Pflichtfelder ausgefüllt?
  function isFormValid() {
    // Prüfe, ob ausgewählte Tage mit Urlaubstagen der Mitarbeiter kollidieren
    const daysToCheck = (() => {
      if (copyMode && selectedCopyEntry && selectedDays.length === 0) {
        // Bei kopierten tagübergreifenden Einträgen: Starttag und Folgetag
        const startDate = new Date(selectedCopyEntry.start);
        const endDate = new Date(selectedCopyEntry.ende);
        const isCrossDay = startDate.toDateString() !== endDate.toDateString();
        
        if (isCrossDay) {
          // Bei tagübergreifenden Einträgen: Starttag und Folgetag
          const startDay = format(startDate, 'yyyy-MM-dd');
          const nextDay = format(addDays(startDate, 1), 'yyyy-MM-dd');
          return [startDay, nextDay];
        } else {
          // Bei eintägigen Einträgen: Nur der Tag selbst
          return [selectedCopyEntry.day];
        }
      } else {
        // Bei normalen Einträgen: Ausgewählte Tage
        return selectedDays;
      }
    })();
    
    const hasVacationConflict = daysToCheck.some(day => 
      selectedEmployees.some(employeeName => {
        const employee = availableEmployees.find(e => e.name === employeeName);
        return employee && isEmployeeOnVacationOnDay(employee, day);
      })
    );

    // Prüfe auf negative Stunden (Endzeit vor Startzeit am gleichen Tag) - nur bei nicht-tagübergreifenden Einträgen
    const hasNegativeHours = !isMultiDay && startTime && endTime && endTime <= startTime;

    // Wenn Zeiten kopieren aktiviert ist und ein Eintrag ausgewählt ist, prüfe nur die grundlegenden Felder
    if (copyMode && selectedCopyEntry) {
      return (
        selectedEmployees.length > 0 &&
        formData.funktion
      );
    }

    // Wenn Zeiten kopieren aktiviert ist, aber kein Eintrag ausgewählt, prüfe die grundlegenden Felder
    if (copyMode) {
      return (
        selectedEmployees.length > 0 &&
        formData.funktion &&
        startTime &&
        endTime &&
        selectedCopyEntry !== null
      );
    }

    // Wenn tagübergreifend aktiviert ist, prüfe die ausgewählten Tage und Uhrzeiten
    if (isMultiDay) {
      // Bei kopierten tagübergreifenden Einträgen sind keine Tage erforderlich, da der Tag aus dem kopierten Eintrag verwendet wird
      const hasValidDays = copyMode && selectedCopyEntry ? true : selectedDays.length > 0;
      
      return (
        selectedEmployees.length > 0 &&
        formData.funktion &&
        hasValidDays &&
        startTime &&
        endTime &&
        !hasVacationConflict &&
        !hasNegativeHours
      );
    } else {
      // Wenn nicht tagübergreifend, prüfe nur die ausgewählten Tage
      // Bei Zeiten kopieren sind keine Tage erforderlich, da der Tag aus dem kopierten Eintrag verwendet wird
      const hasValidDays = copyMode && selectedCopyEntry ? true : selectedDays.length > 0;
      
      return (
        selectedEmployees.length > 0 &&
        formData.funktion &&
        startTime &&
        endTime &&
        hasValidDays &&
        !hasVacationConflict &&
        !hasNegativeHours
      );
    }
  }

  // handleSubmit muss vor dem Render-Teil deklariert sein
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (plausiError) return;
    if (selectedEmployees.length === 0) return;
    
    try {
      for (const name of selectedEmployees) {
        // Bestimme die Start- und Endtage basierend auf isMultiDay und copyMode
        let entryStartDay = startDay;
        let entryEndDay = endDay;
        let entryStartTime = startTime;
        let entryEndTime = endTime;
        
        // Wenn Zeiten kopieren aktiviert ist und ein Eintrag ausgewählt ist, verwende die kopierten Zeiten
        if (copyMode && selectedCopyEntry) {
          entryStartDay = selectedCopyEntry.start.slice(0, 10);
          entryEndDay = selectedCopyEntry.ende.slice(0, 10);
          entryStartTime = selectedCopyEntry.start.slice(11, 16);
          entryEndTime = selectedCopyEntry.ende.slice(11, 16);
        }
        
        if (!isMultiDay) {
          // Wenn nicht tagübergreifend, verwende die ausgewählten Tage
          // Wenn Zeiten kopieren aktiviert ist und keine Tage ausgewählt sind, verwende den Tag aus dem kopierten Eintrag
          const daysToUse = copyMode && selectedCopyEntry && selectedDays.length === 0 
            ? [selectedCopyEntry.day] 
            : selectedDays;
          
          // Für jeden ausgewählten Tag einen separaten Eintrag erstellen
          for (const day of daysToUse) {
            const startISO = `${day}T${entryStartTime}`;
            const endISO = `${day}T${entryEndTime}`;
            const sonntagsstunden = calculateSundayHours(startISO, endISO);
            
            // Prüfe, ob dieser Tag als Feiertag markiert ist
            const isHoliday = selectedHolidayDays.includes(format(parseISO(day), 'dd.MM.yyyy', { locale: de }));
            
            // Berechne die Gesamtstunden (abzüglich Pause)
            const gesamtStunden = calculateHoursForDay(startISO, endISO) - (parseFloat(formData.pause.replace(',', '.')) || 0);
            
            // Berechne die Feiertags-Stunden (für eintägige Einträge sind das die Gesamtstunden)
            const feiertagsStunden = isHoliday ? Math.round(gesamtStunden) : 0;
            
            const entry: TimeEntryWithSunday = {
              id: initialEntry?.id || Date.now().toString() + '-' + name + '-' + day,
              name,
              funktion: formData.funktion,
              start: startISO,
              ende: endISO,
              stunden: gesamtStunden,
              pause: formData.pause,
              extra: parseFloat(formData.extra.replace(',', '.')) || 0,
              fahrtstunden: parseFloat(formData.fahrtstunden.replace(',', '.')) || 0,
              feiertag: feiertagsStunden,
              sonntag: formData.sonntag ? 1 : 0,
              sonntagsstunden,
              bemerkung: formData.bemerkung,
              nachtzulage: calculateNightBonus(startISO, endISO, formData.pause).toString()
            };
            
            await onAdd(day, entry);
          }
        } else {
          // Wenn tagübergreifend, erstelle für jeden ausgewählten Tag einen separaten Eintrag
          // Bei kopierten tagübergreifenden Einträgen verwende den Tag aus dem kopierten Eintrag
          const daysToUse = copyMode && selectedCopyEntry && selectedDays.length === 0 
            ? [selectedCopyEntry.day] 
            : selectedDays;
          
          for (const day of daysToUse) {
            // Berechne den Folgetag für den Endzeitpunkt
            const nextDay = addDays(parseISO(day), 1);
            const nextDayStr = format(nextDay, 'yyyy-MM-dd');
            
            const startISO = `${day}T${entryStartTime}`;
            const endISO = `${nextDayStr}T${entryEndTime}`;
            const sonntagsstunden = calculateSundayHours(startISO, endISO);
            
            // Prüfe, ob der Starttag oder Endtag als Feiertag markiert ist
            const isStartDayHoliday = selectedHolidayDays.includes(format(parseISO(day), 'dd.MM.yyyy', { locale: de }));
            const isEndDayHoliday = selectedHolidayDays.includes(format(parseISO(nextDayStr), 'dd.MM.yyyy', { locale: de }));
            
            // Berechne die Gesamtstunden (immer die komplette Zeitspanne, abzüglich Pause)
            const gesamtStunden = calculateHoursForDay(startISO, endISO) - (parseFloat(formData.pause.replace(',', '.')) || 0);
            
            // Berechne die Feiertags-Stunden für beide Tage
            let feiertagsStunden: number = 0;
            if (isStartDayHoliday) {
              // Stunden für den Starttag (bis Mitternacht)
              const startDate = new Date(startISO);
              const endOfDay = new Date(day + 'T23:59:59');
              feiertagsStunden += Math.round((endOfDay.getTime() - startDate.getTime()) / (1000 * 60 * 60));
            }
            if (isEndDayHoliday) {
              // Stunden für den Endtag (von Mitternacht bis Endzeit)
              const startOfDay = new Date(nextDayStr + 'T00:00:00');
              const endDate = new Date(endISO);
              feiertagsStunden += Math.round((endDate.getTime() - startOfDay.getTime()) / (1000 * 60 * 60));
            }
            
            const entry: TimeEntryWithSunday = {
              id: initialEntry?.id || Date.now().toString() + '-' + name + '-' + day,
              name,
              funktion: formData.funktion,
              start: startISO,
              ende: endISO,
              stunden: gesamtStunden,
              pause: formData.pause,
              extra: parseFloat(formData.extra.replace(',', '.')) || 0,
              fahrtstunden: parseFloat(formData.fahrtstunden.replace(',', '.')) || 0,
              feiertag: feiertagsStunden,
              sonntag: formData.sonntag ? 1 : 0,
              sonntagsstunden,
              bemerkung: formData.bemerkung,
              nachtzulage: calculateNightBonus(startISO, endISO, formData.pause).toString()
            };
            await onAdd(day, entry);
          }
        }
      }
      onClose();
    } catch (err: any) {
      if (err?.response?.status === 409 || err?.message?.includes('bereits im Projekt')) {
        setApiError(err?.response?.data?.error || 'Mitarbeiter ist an einem der Tage bereits eingetragen.');
      } else {
        setApiError('Fehler beim Speichern des Zeiteintrags.');
      }
    }
  };

  // Die Zeiten-kopieren-Checkbox wird nur angezeigt, wenn keine Mitarbeiter ausgewählt sind
  return (
    <div className="overflow-y-auto py-4">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-semibold text-slate-700">
              Mitarbeiter *
            </Label>
            <MultiSelectDropdown
              label="Mitarbeiter"
              options={availableEmployees.map(e => e.name)}
              selected={selectedEmployees}
              onChange={setSelectedEmployees}
              placeholder="Mitarbeiter wählen"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="funktion" className="text-sm font-semibold text-slate-700">
              Funktion *
            </Label>
            <Select
              value={formData.funktion}
              onValueChange={value => setFormData(prev => ({ ...prev, funktion: value as MitarbeiterFunktion }))}
              disabled={commonFunctions.length === 0}
            >
              <SelectTrigger className="rounded-xl border-slate-200 h-12">
                <SelectValue placeholder={selectedEmployees.length === 0 || commonFunctions.length === 0 ? 'Bitte Mitarbeiter wählen' : 'Funktion wählen'} />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {commonFunctions.map(f => (
                  <SelectItem key={f} value={f}>{f}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tag-Auswahl direkt unter Funktion */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-slate-700">Einsatztage auswählen *</Label>
            <div className="flex items-center space-x-6 p-3 bg-slate-50 rounded-none mb-2">
              <div className="flex items-center space-x-3">
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
              <div className="flex items-center space-x-3">
                <Checkbox 
                  id="isMultiDay"
                  checked={isMultiDay} 
                  onCheckedChange={(checked) => setIsMultiDay(!!checked)} 
                  className="rounded"
                />
                <Label htmlFor="isMultiDay" className="text-sm font-medium text-slate-700">
                  Tagübergreifend
                </Label>
              </div>
              <div className="flex items-center space-x-3">
                <Checkbox 
                  id="copyMode" 
                  checked={copyMode} 
                  onCheckedChange={checked => setCopyMode(!!checked)} 
                  disabled={!hasExistingTimeEntries}
                  className="rounded"
                />
                <Label htmlFor="copyMode" className={`text-sm font-medium ${!hasExistingTimeEntries ? 'text-slate-400' : 'text-slate-700'}`}>
                  Zeiten kopieren
                </Label>
              </div>
            </div>
            {!copyMode && (
              <div className="flex flex-wrap gap-2 p-3 bg-slate-50 rounded-none max-h-32 overflow-y-auto project-times-add">
                {projectDays.map(day => {
                  // Prüfe, ob der ausgewählte Mitarbeiter an diesem Tag im Urlaub ist
                  const isSelectedEmployeeOnVacation = selectedEmployees.length > 0 && 
                    selectedEmployees.some(employeeName => {
                      const employee = availableEmployees.find(e => e.name === employeeName);
                      return employee && isEmployeeOnVacationOnDay(employee, day);
                    });
                  
                  // Prüfe, ob der Tag belegt ist (durch andere Einträge)
                  const isBelegt = belegteTage.includes(day);
                  
                  // Tag ist disabled wenn: im copyMode und belegt, ODER Mitarbeiter ist im Urlaub
                  const isDisabled = copyMode ? isBelegt : isSelectedEmployeeOnVacation;
                  
                  // Bestimme die Button-Variante basierend auf Status
                  let buttonVariant: "default" | "outline" = selectedDays.includes(day) ? 'default' : 'outline';
                  let buttonClassName = `rounded-xl transition-all duration-200 ${
                    selectedDays.includes(day)
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'border-slate-200 hover:bg-slate-100'
                  }`;
                  
                  if (isDisabled) {
                    buttonClassName = 'bg-gray-200 text-gray-400 cursor-not-allowed rounded-xl';
                  }
                  
                  // Bestimme den Status-Text
                  let statusText = '';
                  if (isSelectedEmployeeOnVacation) {
                    statusText = '(Urlaub)';
                  } else if (isBelegt && !isSelectedEmployeeOnVacation) {
                    statusText = '(Belegt)';
                  }
                  
                  return (
                    <Button
                      key={day}
                      type="button"
                      variant={buttonVariant}
                      size="sm"
                      disabled={isDisabled}
                      className={buttonClassName}
                      onClick={() => !isDisabled && handleDayToggle(day)}
                    >
                      {format(parseISO(day), 'dd.MM.yyyy', { locale: de })}
                      {statusText && (
                        <span className={`ml-1 text-xs ${
                          isSelectedEmployeeOnVacation ? 'text-red-500' : 'text-orange-500'
                        }`}>
                          {statusText}
                        </span>
                      )}
                    </Button>
                  );
                })}
              </div>
            )}
            {/* Zeiten kopieren Auswahl */}
            {copyMode && hasExistingTimeEntries && (
              <div className="mt-2">
                <Label className="text-xs text-slate-600 mb-1 block">Vorhandene Zeiteinträge auswählen:</Label>
                <Select
                  value={selectedCopyEntry ? getEntryValue(selectedCopyEntry) : ''}
                  onValueChange={val => {
                    const found = kopierbareEintraege.find(e => getEntryValue(e) === val) || allOtherEntries.find(e => getEntryValue(e) === val);
                    setSelectedCopyEntry(found || null);
                  }}
                >
                  <SelectTrigger className="rounded-xl border-slate-200 h-10">
                    <span className="truncate text-xs">
                      {selectedCopyEntry ? getEntryLabel(selectedCopyEntry) : 'Eintrag wählen'}
                    </span>
                  </SelectTrigger>
                  <SelectContent className="rounded-xl max-h-40 overflow-y-auto w-full">
                    {kopierbareEintraege.length === 0 && <div className="px-3 py-2 text-slate-400 text-sm">Keine Einträge vorhanden</div>}
                    {/* Immer auch den aktuell gewählten Eintrag anzeigen, falls nicht in kopierbareEintraege */}
                    {selectedCopyEntry &&
                      !kopierbareEintraege.some(e => getEntryValue(e) === getEntryValue(selectedCopyEntry)) &&
                      <SelectItem key={getEntryValue(selectedCopyEntry)} value={getEntryValue(selectedCopyEntry)} className="text-xs">
                        {getEntryLabel(selectedCopyEntry)}
                      </SelectItem>
                    }
                    {kopierbareEintraege.map(e => (
                      <SelectItem key={getEntryValue(e)} value={getEntryValue(e)} className="text-xs">
                        {getEntryLabel(e)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {!copyMode || !selectedCopyEntry ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="start" className="text-sm font-semibold text-slate-700">Startzeit *</Label>
                  <Input
                    id="start"
                    type="time"
                    value={startTime}
                    onChange={e => setStartTime(e.target.value)}
                    className="rounded-xl border-slate-200 focus:border-blue-500 focus:ring-blue-500 h-12 w-24"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ende" className="text-sm font-semibold text-slate-700">Endzeit *</Label>
                  <Input
                    id="ende"
                    type="time"
                    value={endTime}
                    onChange={e => setEndTime(e.target.value)}
                    className="rounded-xl border-slate-200 focus:border-blue-500 focus:ring-blue-500 h-12 w-24"
                    required
                  />
                </div>
              </>
            ) : (
              <div className="col-span-2">
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
                  <p className="text-sm text-blue-800 dark:text-blue-200 font-medium">
                    Zeiten werden aus dem ausgewählten Eintrag übernommen:
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-300 mt-1">
                    {selectedCopyEntry.start.slice(11, 16)} - {selectedCopyEntry.ende.slice(11, 16)}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pause" className="text-sm font-semibold text-slate-700">
                Pause (Stunden)
              </Label>
              <Select value={formData.pause} onValueChange={(value) => setFormData(prev => ({ ...prev, pause: value }))}>
                <SelectTrigger className="rounded-xl border-slate-200 focus:border-blue-500 focus:ring-blue-500 h-12">
                  <SelectValue placeholder="Pause wählen" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {pauseOptions.map((option) => (
                    <SelectItem key={option} value={option}>{option}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fahrtstunden" className="text-sm font-semibold text-slate-700">
                Fahrtstunden
              </Label>
              <Input
                id="fahrtstunden"
                value={formData.fahrtstunden}
                onChange={(e) => setFormData(prev => ({ ...prev, fahrtstunden: e.target.value }))}
                placeholder="0,5"
                className="rounded-xl border-slate-200 focus:border-blue-500 focus:ring-blue-500 h-12"
              />
            </div>
            <div className="space-y-2 col-span-2">
              <Label htmlFor="extra" className="text-sm font-semibold text-slate-700">
                Extra
              </Label>
              <Input
                id="extra"
                type="number"
                min={1}
                max={20}
                value={formData.extra}
                onChange={e => {
                  const val = e.target.value;
                  if (val === '' || (/^\d+$/.test(val) && +val >= 1 && +val <= 20)) {
                    setFormData(prev => ({ ...prev, extra: val }));
                  }
                }}
                placeholder="Extrastunden"
                className="rounded-xl border-slate-200 focus:border-blue-500 focus:ring-blue-500 h-12"
              />
            </div>
          </div>

          <div className="flex gap-6 p-3 bg-slate-50 rounded-xl">
            <div className="flex items-center space-x-3">
              <Checkbox
                id="feiertag"
                checked={formData.feiertag}
                onCheckedChange={(checked) => {
                  setFormData(prev => ({ ...prev, feiertag: checked as boolean }));
                  setShowHolidayDropdown(checked as boolean);
                  if (!checked) {
                    setSelectedHolidayDays([]);
                  }
                }}
                className="rounded"
              />
              <Label htmlFor="feiertag" className="text-sm font-medium text-slate-700">Feiertag</Label>
            </div>
            {showHolidayDropdown && (selectedDays.length > 0 || (copyMode && selectedCopyEntry)) && (
              <div className="flex-1">
                <Label className="text-xs text-slate-600 mb-1 block">Feiertage auswählen:</Label>
                <MultiSelectDropdown
                  label=""
                  options={
                    (() => {
                      if (copyMode && selectedCopyEntry) {
                        // Bei kopierten tagübergreifenden Einträgen: Starttag und Folgetag
                        const startDate = new Date(selectedCopyEntry.start);
                        const endDate = new Date(selectedCopyEntry.ende);
                        const isCrossDay = startDate.toDateString() !== endDate.toDateString();
                        
                        if (isCrossDay) {
                          // Bei tagübergreifenden Einträgen: Starttag und Folgetag
                          const startDay = format(startDate, 'yyyy-MM-dd');
                          const nextDay = format(addDays(startDate, 1), 'yyyy-MM-dd');
                          return [startDay, nextDay].map(day => format(parseISO(day), 'dd.MM.yyyy', { locale: de }));
                        } else {
                          // Bei eintägigen Einträgen: Nur der Tag selbst
                          return [selectedCopyEntry.day].map(day => format(parseISO(day), 'dd.MM.yyyy', { locale: de }));
                        }
                      } else {
                        // Bei normalen Einträgen: Ausgewählte Tage
                        return selectedDays.map(day => format(parseISO(day), 'dd.MM.yyyy', { locale: de }));
                      }
                    })()
                  }
                  selected={selectedHolidayDays}
                  onChange={setSelectedHolidayDays}
                  placeholder="Feiertage wählen"
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="bemerkung" className="text-sm font-semibold text-slate-700">
              Bemerkung
            </Label>
            <Input
              id="bemerkung"
              value={formData.bemerkung}
              onChange={(e) => setFormData(prev => ({ ...prev, bemerkung: e.target.value }))}
              placeholder="Optionale Bemerkung"
              className="rounded-xl border-slate-200 focus:border-blue-500 focus:ring-blue-500 h-12"
            />
          </div>
        </div>

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
            disabled={!isFormValid()}
            className={`bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-12 px-6 shadow-lg hover:shadow-xl transition-all duration-200 ${!isFormValid() ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            Hinzufügen
          </Button>
        </div>
      </form>
      {plausiError && (
        <div className="text-red-600 text-xs mt-1">{plausiError}</div>
      )}
      {/* Anzeige der automatisch berechneten Sonntagsstunden */}
      {(() => {
        if (isMultiDay) return null; // Bei tagübergreifenden Einträgen nicht anzeigen
        if (!startTime || !endTime) return null;
        const startISO = `${startDay}T${startTime}`;
        const endISO = `${endDay}T${endTime}`;
        const sonntagsstunden = calculateSundayHours(startISO, endISO);
        if (sonntagsstunden > 0) {
          return <div className="text-blue-700 text-xs mt-1">Automatisch berechnete Sonntagsstunden: {sonntagsstunden.toFixed(2)}</div>;
        }
        return null;
      })()}
    </div>
  )
} 