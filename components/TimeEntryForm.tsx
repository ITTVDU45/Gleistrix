"use client";
import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { Input } from './ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Button } from './ui/button'
import { Checkbox } from './ui/checkbox'
import { Label } from './ui/label'
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs'
import Link from 'next/link'
import type { Project, TimeEntry, MitarbeiterFunktion, Employee, ExternalWorkerFunction } from '../types'
import type { BreakSegment } from '@/lib/timeEntry'
import { format, parseISO, addDays } from 'date-fns'
import { de } from 'date-fns/locale'
import { useProjects } from '../hooks/useProjects'
import { Alert } from './ui/alert'
import { AlertCircle, Loader2, Plus } from 'lucide-react'
import MultiSelectDropdown from './ui/MultiSelectDropdown';
import { useEmployees } from '../hooks/useEmployees';
import { BreakSegmentEditor } from './BreakSegmentEditor'
import { HolidaysApi } from '@/lib/api/holidays'
import { useSubcompanies } from '../hooks/useSubcompanies'
import { MITARBEITER_FUNKTION_OPTIONS } from '@/types/constants'

// Modulare TimeEntry-Utilities importieren
import {
  type TimeEntryWithSunday,
  type BuildEntryParams,
  buildTimeEntry,
  buildTimeEntriesForDays,
  calculateSundayHours,
  processBatch,
  formatBatchErrorReport,
  calculateRequiredBreakMinutes,
  calculateBreakSegments
} from '@/lib/timeEntry'

interface TimeEntryFormProps {
  project: Project
  selectedDate: string
  onAdd: (entriesOrDates: Array<{day: string, entry: TimeEntry}> | string[] | string, entry?: TimeEntry) => void
  onClose: () => void
  employees?: Employee[]
  initialEntry?: Partial<TimeEntry>
  hasExistingTimeEntries?: boolean
}

const buildExternalWorkerFunctions = (
  count: number,
  previousRows: ExternalWorkerFunction[] = [],
  fallbackFunction?: string
): ExternalWorkerFunction[] => {
  const safeCount = Number.isFinite(count) && count > 0 ? Math.floor(count) : 1
  return Array.from({ length: safeCount }, (_, idx) => {
    const workerIndex = idx + 1
    const previous = previousRows[idx]
    return {
      workerIndex,
      funktion: previous?.funktion || fallbackFunction || ''
    }
  })
}

const getExternalFallbackFunction = (rows: ExternalWorkerFunction[]): string => {
  const unique = Array.from(new Set(rows.map((row) => String(row.funktion || '').trim()).filter(Boolean)))
  if (unique.length === 1) return unique[0]
  return unique.length > 1 ? 'Gemischt' : ''
}

const summarizeExternalWorkerFunctions = (rows: ExternalWorkerFunction[]): string => {
  const counters = new Map<string, number>()
  rows.forEach((row) => {
    const key = String(row.funktion || '').trim()
    if (!key) return
    counters.set(key, (counters.get(key) || 0) + 1)
  })
  return Array.from(counters.entries())
    .sort((a, b) => a[0].localeCompare(b[0], 'de'))
    .map(([funktion, count]) => `${count}x ${funktion}`)
    .join(', ')
}

export function TimeEntryForm({ project, selectedDate, onAdd, onClose, employees = [], initialEntry, hasExistingTimeEntries = false }: TimeEntryFormProps) {
  const { isEmployeeOnVacationDuringPeriod } = useEmployees();
  const { subcompanies } = useSubcompanies();
  const [activeTab, setActiveTab] = React.useState<'internal' | 'external'>(
    initialEntry?.isExternal ? 'external' : 'internal'
  );
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
  const [externalCompanyId, setExternalCompanyId] = React.useState(initialEntry?.externalCompanyId || '')
  const [externalCount, setExternalCount] = React.useState<number>(
    typeof initialEntry?.externalCount === 'number' && initialEntry.externalCount > 0 ? initialEntry.externalCount : 1
  )
  const [externalWorkerFunctions, setExternalWorkerFunctions] = React.useState<ExternalWorkerFunction[]>(
    buildExternalWorkerFunctions(
      typeof initialEntry?.externalCount === 'number' && initialEntry.externalCount > 0 ? initialEntry.externalCount : 1,
      (initialEntry?.externalWorkerFunctions as ExternalWorkerFunction[] | undefined) || [],
      typeof initialEntry?.funktion === 'string' ? initialEntry.funktion : ''
    )
  )

  const selectedExternalCompany = React.useMemo(
    () => subcompanies.find((company) => company.id === externalCompanyId),
    [subcompanies, externalCompanyId]
  )

  React.useEffect(() => {
    if (!externalCompanyId && initialEntry?.externalCompanyName) {
      const match = subcompanies.find((company) => company.name === initialEntry.externalCompanyName)
      if (match) setExternalCompanyId(match.id)
    }
  }, [externalCompanyId, initialEntry?.externalCompanyName, subcompanies])

  // Wenn initialEntry sich Ã¤ndert (z.B. beim Bearbeiten), setze die Formulardaten neu
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

      const initialExternalCount =
        typeof initialEntry?.externalCount === 'number' && initialEntry.externalCount > 0
          ? initialEntry.externalCount
          : 1
      setExternalCount(initialExternalCount)
      setExternalWorkerFunctions(
        buildExternalWorkerFunctions(
          initialExternalCount,
          (initialEntry?.externalWorkerFunctions as ExternalWorkerFunction[] | undefined) || [],
          typeof initialEntry?.funktion === 'string' ? initialEntry.funktion : ''
        )
      )
    }
  }, [initialEntry]);

  React.useEffect(() => {
    if (activeTab !== 'external') return
    setExternalWorkerFunctions((prev) => buildExternalWorkerFunctions(externalCount, prev))
  }, [activeTab, externalCount])

  // Pausenoptionen 0, 0,25, 0,5, 0,75, ... 12 (0,25 Schritte)
  const pauseOptions = useMemo(() => {
    const options: string[] = [];
    // 12 / 0.25 = 48 steps
    for (let i = 0; i <= 48; i++) {
      const val = +(i * 0.25).toFixed(2);
      // Use comma as decimal separator (German format)
      const strVal = Number.isInteger(val) ? val.toString() : val.toString().replace('.', ',');
      options.push(strVal);
    }
    return options;
  }, []);

  // Funktionen des gewÃ¤hlten Mitarbeiters
  const selectedEmployee = employees.find(e => e.name === formData.name);
  const employeeFunctions = selectedEmployee?.position?.split(',').map(f => f.trim()).filter(Boolean) || [];

  // Alle ZeiteintrÃ¤ge an diesem Tag (aus allen Projekten, falls Ã¼bergeben)
  const allEntriesForDate = useMemo(() => {
    if (!selectedDate) return [];
    return Object.values(project.mitarbeiterZeiten?.[selectedDate] || []);
  }, [project, selectedDate]);

  const { projects: allProjects } = useProjects();
  const [apiError, setApiError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitProgress, setSubmitProgress] = useState({ current: 0, total: 0 })

  function isEmployeeAssignedElsewhere(employeeName: string, day: string, currentProjectId: string, projects: Project[]): boolean {
    return projects.some(p => {
      if (p.id === currentProjectId) return false;
      if (!p.mitarbeiterZeiten || !p.mitarbeiterZeiten[day]) return false;
      return p.mitarbeiterZeiten[day].some((entry: any) => entry.name === employeeName);
    });
  }

  // PrÃ¼fe, ob ein Mitarbeiter an diesem Tag und Zeitraum bereits einen Eintrag hat
  function isEmployeeBlocked(employee: Employee) {
    if (!formData.start || !formData.ende) return false;
    const start = formData.start;
    const ende = formData.ende;
    return allEntriesForDate.some((entry: any) => {
      if (entry.name !== employee.name) return false;
      // ZeitÃ¼berschneidung prÃ¼fen
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

  // Filtere Mitarbeiter basierend auf Urlaubsstatus wÃ¤hrend der Projektzeit
  const availableEmployees = useMemo(() => {
    // Zeige alle Mitarbeiter an - die Filterung erfolgt bei der Tag-Auswahl
    return employees;
  }, [employees]);

  // Neue Funktion: PrÃ¼ft, ob ein Mitarbeiter an einem spezifischen Tag im Urlaub ist
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

  // Feiertage aus DB laden
  const [dbHolidays, setDbHolidays] = useState<string[]>([])
  useEffect(() => {
    const loadHolidays = async () => {
      try {
        const response = await HolidaysApi.list()
        if (response.success && response.holidays) {
          // Format: YYYY-MM-DD
          setDbHolidays(response.holidays.map(h => h.date))
        }
      } catch (error) {
        console.error('Fehler beim Laden der Feiertage:', error)
      }
    }
    loadHolidays()
  }, [])

  // PrÃ¼fe welche ausgewÃ¤hlten Tage Feiertage sind (aus DB)
  const detectedHolidays = useMemo(() => {
    return selectedDays.filter(day => dbHolidays.includes(day))
  }, [selectedDays, dbHolidays])

  // Automatische Pausenberechnung States
  const [overrideBreaks, setOverrideBreaks] = useState(false)
  const [breakSegments, setBreakSegments] = useState<BreakSegment[]>([])

  // Wenn Pausen manuell bearbeitet werden, Pause-Feld synchron halten
  useEffect(() => {
    if (!overrideBreaks || breakSegments.length === 0) return
    const breakTotalMinutes = breakSegments.reduce((sum, seg) => {
      const start = new Date(seg.start)
      const end = new Date(seg.end)
      return sum + (end.getTime() - start.getTime()) / (1000 * 60)
    }, 0)
    const pauseHours = +(breakTotalMinutes / 60).toFixed(2)
    // Format wie pauseOptions: ganze Zahlen ohne Nachkommastellen, sonst mit Komma
    const pauseStr = Number.isInteger(pauseHours) ? pauseHours.toString() : pauseHours.toString().replace('.', ',')
    setFormData(prev => ({ ...prev, pause: pauseStr }))
  }, [overrideBreaks, breakSegments])

  // Fallback: Wenn kein Tag ausgewÃ¤hlt ist, nutze den ersten Projekttag
  useEffect(() => {
    if (selectedDays.length === 0 && !selectedDate && projectDays.length > 0) {
      setSelectedDays([projectDays[0]])
    }
  }, [selectedDays.length, selectedDate, projectDays])

  // Automatische Pausenberechnung bei Start/Ende-Ã„nderung (rein lokal, kein API-Call)
  // WICHTIG: Nutze startTimeValue/endTimeValue, die als Parameter Ã¼bergeben werden
  const calculateBreaksAndPremiums = useCallback((force = false, startTimeValue?: string, endTimeValue?: string) => {
    // Fallback auf formData wenn keine Parameter Ã¼bergeben
    const start = startTimeValue || formData.start
    const ende = endTimeValue || formData.ende

    if (overrideBreaks && !force) return

    // PrÃ¼fe ob Start und Ende gesetzt sind
    if (!start || !ende) {
      setBreakSegments([])
      return
    }

    // Verwende selectedDate als Fallback, wenn keine Tage ausgewÃ¤hlt sind
    const day = selectedDays[0] || selectedDate || projectDays[0]
    if (!day) {
      setBreakSegments([])
      return
    }

    let endDay = day
    
    // Bei tagÃ¼bergreifend oder wenn Ende < Start (z.B. 22:00 - 09:00)
    const isOvernight = ende < start
    if (isMultiDay || isOvernight) {
      endDay = format(addDays(parseISO(day), 1), 'yyyy-MM-dd')
    }

    const startISO = `${day}T${start}`
    const endISO = `${endDay}T${ende}`

    // Lokale Pausenberechnung (keine API-Aufrufe mehr)
    const totalDurationMinutes = (new Date(endISO).getTime() - new Date(startISO).getTime()) / (1000 * 60)
    const requiredBreakMinutes = calculateRequiredBreakMinutes(totalDurationMinutes)
    const localBreaks = calculateBreakSegments(startISO, endISO, requiredBreakMinutes)
    setBreakSegments(localBreaks)

    const localBreakTotalMinutes = localBreaks.reduce((sum, seg) => {
      const segStart = new Date(seg.start)
      const segEnd = new Date(seg.end)
      return sum + (segEnd.getTime() - segStart.getTime()) / (1000 * 60)
    }, 0)
    const pauseHours = +(localBreakTotalMinutes / 60).toFixed(2)
    // Format wie pauseOptions: ganze Zahlen ohne Nachkommastellen, sonst mit Komma
    const pauseStr = Number.isInteger(pauseHours) ? pauseHours.toString() : pauseHours.toString().replace('.', ',')
    setFormData(prev => ({ ...prev, pause: pauseStr }))
  }, [selectedDays, selectedDate, projectDays, isMultiDay, overrideBreaks])

  // Alle Tage auswÃ¤hlen
  const handleSelectAllDays = (checked: boolean) => {
    setSelectAllDays(checked)
    if (checked) {
      if (activeTab === 'external') {
        setSelectedDays(projectDays)
        return
      }
      // WÃ¤hle nur Tage aus, an denen der ausgewÃ¤hlte Mitarbeiter nicht im Urlaub ist
      const availableDays = projectDays.filter(day => {
        if (selectedEmployees.length === 0) return false;
        
        // PrÃ¼fe, ob der Mitarbeiter an diesem Tag im Urlaub ist
        const isOnVacation = selectedEmployees.some(employeeName => {
          const employee = availableEmployees.find(e => e.name === employeeName);
          return employee && isEmployeeOnVacationOnDay(employee, day);
        });
        
        // PrÃ¼fe, ob der Tag bereits belegt ist (fÃ¼r alle ausgewÃ¤hlten Mitarbeiter)
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
      
      if (activeTab === 'external') {
        setSelectAllDays(newSelected.length === projectDays.length && projectDays.length > 0);
        return newSelected;
      }

      // PrÃ¼fe, ob alle verfÃ¼gbaren Tage ausgewÃ¤hlt sind
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

  // State fÃ¼r Kopierfunktion
  const [copyMode, setCopyMode] = useState(false);
  const [selectedCopyEntry, setSelectedCopyEntry] = useState<any | null>(null);

  useEffect(() => {
    if (activeTab === 'external') {
      setCopyMode(false);
      setSelectedCopyEntry(null);
    }
  }, [activeTab]);

  // Label fÃ¼r aktuell ausgewÃ¤hlten Eintrag im Zeiten-kopieren-Select
  const selectedCopyEntryLabel = selectedCopyEntry
    ? `${selectedCopyEntry.name} | ${selectedCopyEntry.funktion} | ${selectedCopyEntry.day} | ${selectedCopyEntry.start} - ${selectedCopyEntry.ende}`
    : '';

  // Hilfsfunktion fÃ¼r Label eines Eintrags
  const getEntryLabel = (e: any) =>
    `${e.name} | ${e.funktion} | ${format(parseISO(e.day), 'dd.MM', { locale: de })} | ${e.start.slice(11, 16)} - ${e.ende.slice(11, 16)}`;

  // Hilfsfunktion fÃ¼r den Wert eines Eintrags
  const getEntryValue = (e: any) => `${e.id}-${e.day}`;

  // Alle bisherigen ZeiteintrÃ¤ge anderer Mitarbeiter (auÃŸer aktuell bearbeiteten, aber NICHT nach formData.name filtern)
  const allOtherEntries = useMemo(() => {
    const entries: any[] = [];
    Object.entries(project.mitarbeiterZeiten || {}).forEach(([day, arr]: any) => {
      (arr || []).forEach((entry: any) => {
        // Optional: Wenn du den aktuell bearbeiteten Eintrag (z.B. beim Editieren) ausschlieÃŸen willst, prÃ¼fe auf initialEntry.id
        if (!initialEntry || entry.id !== initialEntry.id || entry.day !== selectedDate) {
          entries.push({ ...entry, day });
        }
      });
    });
    return entries;
  }, [project.mitarbeiterZeiten, initialEntry, selectedDate]);

  // Wenn ein Eintrag ausgewÃ¤hlt wird, Ã¼bernehme NUR Zeiten, lasse Name, Funktion und Tage unverÃ¤ndert
  useEffect(() => {
    if (selectedCopyEntry) {
      // PrÃ¼fe, ob der kopierte Eintrag tagÃ¼bergreifend ist
      const startDate = new Date(selectedCopyEntry.start);
      const endDate = new Date(selectedCopyEntry.ende);
      const isCrossDay = startDate.toDateString() !== endDate.toDateString();
      
      // Wenn tagÃ¼bergreifend, aktiviere den Multi-Day-Modus
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

  // Setze selectedCopyEntry auf null, wenn sich der Mitarbeiter Ã¤ndert
  useEffect(() => {
    setSelectedCopyEntry(null);
  }, [formData.name]);

  // 1. Berechne belegte Tage fÃ¼r den aktuell gewÃ¤hlten Mitarbeiter (projektÃ¼bergreifend)
  const belegteTage = useMemo(() => {
    if (activeTab === 'external') return [];
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

  // Effect fÃ¼r automatische Pausenberechnung - nutzt startTime/endTime
  useEffect(() => {
    if (!overrideBreaks && startTime && endTime) {
      const timer = setTimeout(() => {
        calculateBreaksAndPremiums(false, startTime, endTime)
      }, 500) // Debounce
      return () => clearTimeout(timer)
    }
  }, [startTime, endTime, selectedDays, selectedDate, projectDays, isMultiDay, overrideBreaks, calculateBreaksAndPremiums])

  // Entferne die Validierung fÃ¼r Endzeit-Tag und die EinschrÃ¤nkung der Tag-Auswahl
  // Die folgenden useEffect- und Variablen fÃ¼r belegteTage, freieTage, endDayError, endDayOptions werden entfernt oder ignoriert

  // Wenn sich selectedDate Ã¤ndert, aktualisiere Start- und Endtag (nur bei nicht-tagÃ¼bergreifenden EintrÃ¤gen)
  useEffect(() => {
    if (!isMultiDay && selectedDate) {
      setStartDay(selectedDate);
      setEndDay(selectedDate);
    }
  }, [selectedDate, isMultiDay]);

  // Freie Tage fÃ¼r den Mitarbeiter (projektÃ¼bergreifend, wie bisher)
  const freieTage = useMemo(() => {
    if (!formData.name) return [];
    return projectDays.filter(day => !belegteTage.includes(day));
  }, [projectDays, belegteTage, formData.name]);

  // Endzeit-Tag darf nicht gewÃ¤hlt werden, wenn der Mitarbeiter an diesem Tag schon einen Eintrag hat
  const endDayOptions = freieTage.includes(startDay)
    ? [...freieTage, startDay].filter((v, i, arr) => arr.indexOf(v) === i) // Starttag immer erlauben
    : freieTage;

  // 2. Filtere allOtherEntries fÃ¼r das Dropdown â€žZeiten kopierenâ€œ
  const kopierbareEintraege = useMemo(() => {
    return allOtherEntries.filter(e => !belegteTage.includes(e.day));
  }, [allOtherEntries, belegteTage]);

  // Hilfsfunktionen fÃ¼r Zeitberechnungen sind jetzt in @/lib/timeEntry ausgelagert
  // calculateHoursForDay, calculateNightBonus, calculateSundayHours werden aus dem Modul importiert

  // PlausibilitÃ¤ts-Fehler-Message
  const [plausiError, setPlausiError] = useState<string | null>(null);

  // Automatische Anpassung des Endtags bei Ã¼ber Mitternacht (nur bei nicht-tagÃ¼bergreifenden EintrÃ¤gen)
  useEffect(() => {
    if (isMultiDay || !startDay || !endDay || !startTime || !endTime) return;
    const idx = projectDays.indexOf(startDay);
    // Wenn Endtag gleich Starttag und Endzeit < Startzeit â†’ Endtag auf Folgetag setzen
    if (startDay === endDay && endTime < startTime) {
      // Berechne den Folgetag (auch auÃŸerhalb des Projektzeitraums)
      const nextDay = addDays(parseISO(startDay), 1);
      const nextDayStr = format(nextDay, 'yyyy-MM-dd');
      setEndDay(nextDayStr);
    }
    // Wenn Endtag Folgetag und Endzeit >= Startzeit â†’ Endtag auf Starttag zurÃ¼cksetzen
    const calculatedNextDay = format(addDays(parseISO(startDay), 1), 'yyyy-MM-dd');
    if (endDay === calculatedNextDay && endTime >= startTime) {
      setEndDay(startDay);
    }
  }, [startDay, endDay, startTime, endTime, projectDays, isMultiDay]);

  // PlausibilitÃ¤tsprÃ¼fung fÃ¼r Zeitspanne (blockiere negative und 24h+ ZeitrÃ¤ume)
  useEffect(() => {
    if (isMultiDay || !startDay || !endDay || !startTime || !endTime) {
      setPlausiError(null);
      return;
    }
    
    // Wenn Start- und Endtag gleich sind, prÃ¼fe die Uhrzeiten
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

  // State fÃ¼r Multi-Select Mitarbeiter
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>(initialEntry?.name ? [initialEntry.name] : []);

  // Aktualisiere selectAllDays, wenn sich selectedEmployees Ã¤ndert
  useEffect(() => {
    if (activeTab === 'external') {
      setSelectAllDays(selectedDays.length === projectDays.length && projectDays.length > 0);
      return;
    }
    if (selectedEmployees.length === 0) {
      setSelectAllDays(false);
      return;
    }
    
    // PrÃ¼fe, ob alle verfÃ¼gbaren Tage ausgewÃ¤hlt sind
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
  }, [activeTab, selectedEmployees, selectedDays, projectDays, availableEmployees, allProjects, project.id]);

  // Setze Start- und Endtage automatisch, wenn nicht tagÃ¼bergreifend
  useEffect(() => {
    if (!isMultiDay && selectedDays.length > 0) {
      // Verwende den ersten ausgewÃ¤hlten Tag fÃ¼r Start und Ende
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

  // Synchronisiere selectedHolidayDays wenn sich selectedDays Ã¤ndert
  useEffect(() => {
    if (showHolidayDropdown) {
      // Entferne Feiertags-Tage, die nicht mehr verfÃ¼gbar sind
      setSelectedHolidayDays(prev => 
        prev.filter(holidayDay => {
          const holidayDate = holidayDay.split('.').reverse().join('-'); // Konvertiere dd.MM.yyyy zu yyyy-MM-dd
          let availableDays: string[];
          
          if (copyMode && selectedCopyEntry) {
            // Bei kopierten tagÃ¼bergreifenden EintrÃ¤gen: Starttag und Folgetag
            const startDate = new Date(selectedCopyEntry.start);
            const endDate = new Date(selectedCopyEntry.ende);
            const isCrossDay = startDate.toDateString() !== endDate.toDateString();
            
            if (isCrossDay) {
              // Bei tagÃ¼bergreifenden EintrÃ¤gen: Starttag und Folgetag
              const startDay = format(startDate, 'yyyy-MM-dd');
              const nextDay = format(addDays(startDate, 1), 'yyyy-MM-dd');
              availableDays = [startDay, nextDay];
            } else {
              // Bei eintÃ¤gigen EintrÃ¤gen: Nur der Tag selbst
              availableDays = [selectedCopyEntry.day];
            }
          } else {
            // Bei normalen EintrÃ¤gen: AusgewÃ¤hlte Tage
            // Bei tagÃ¼bergreifenden EintrÃ¤gen: AusgewÃ¤hlte Tage + jeweils Folgetag(e)
            if (isMultiDay) {
              const withNext = selectedDays.flatMap(day => {
                const next = format(addDays(parseISO(day), 1), 'yyyy-MM-dd');
                return [day, next];
              });
              availableDays = Array.from(new Set(withNext));
            } else {
              availableDays = selectedDays;
            }
          }
          
          return availableDays.includes(holidayDate);
        })
      );
    }
  }, [selectedDays, showHolidayDropdown, copyMode, selectedCopyEntry]);

  // Wenn sich selectedDays Ã¤ndert, setze den ersten freien Tag als Startzeit-Tag (nur bei nicht-tagÃ¼bergreifenden EintrÃ¤gen)
  useEffect(() => {
    if (!isMultiDay && selectedDays.length > 0 && (activeTab === 'external' || formData.name)) {
      // Finde den ersten Tag aus selectedDays, der nicht in belegteTage ist
      const firstFreeDay = activeTab === 'external'
        ? selectedDays[0]
        : selectedDays.find(day => !belegteTage.includes(day));
      if (firstFreeDay && firstFreeDay !== startDay) {
        setStartDay(firstFreeDay);
        // Wenn der aktuelle endDay belegt ist oder nicht gesetzt, auch endDay aktualisieren
        if (!endDay || belegteTage.includes(endDay)) {
          setEndDay(firstFreeDay);
        }
      }
    }
  }, [selectedDays, formData.name, belegteTage, isMultiDay, activeTab, startDay, endDay]);

  // State fÃ¼r Mitarbeitersuche
  const [employeeSearch, setEmployeeSearch] = useState('');
  const filteredEmployees = availableEmployees.filter(e => e.name.toLowerCase().includes(employeeSearch.toLowerCase()));

  // Hilfsfunktion: Schnittmenge der Funktionen aller ausgewÃ¤hlten Mitarbeiter
  function getCommonFunctions() {
    if (activeTab === 'external') {
      return MITARBEITER_FUNKTION_OPTIONS.map((option) => option.value);
    }
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

  // Hilfsfunktion: Sind alle Pflichtfelder ausgefÃ¼llt?
  function isFormValid() {
    // Pruefe auf negative Stunden (Endzeit vor Startzeit am gleichen Tag) - nur bei nicht-taguebergreifenden Eintraegen
    const hasNegativeHours = !isMultiDay && startTime && endTime && endTime <= startTime;

    if (activeTab === 'external') {
      const hasAllExternalFunctions =
        externalWorkerFunctions.length === externalCount &&
        externalWorkerFunctions.every((row) => String(row.funktion || '').trim().length > 0)
      return (
        !!selectedExternalCompany &&
        externalCount > 0 &&
        hasAllExternalFunctions &&
        startTime &&
        endTime &&
        selectedDays.length > 0 &&
        !hasNegativeHours
      );
    }

    // PrÃ¼fe, ob ausgewÃ¤hlte Tage mit Urlaubstagen der Mitarbeiter kollidieren
    const daysToCheck = (() => {
      if (copyMode && selectedCopyEntry && selectedDays.length === 0) {
        // Bei kopierten tagÃ¼bergreifenden EintrÃ¤gen: Starttag und Folgetag
        const startDate = new Date(selectedCopyEntry.start);
        const endDate = new Date(selectedCopyEntry.ende);
        const isCrossDay = startDate.toDateString() !== endDate.toDateString();
        
        if (isCrossDay) {
          // Bei tagÃ¼bergreifenden EintrÃ¤gen: Starttag und Folgetag
          const startDay = format(startDate, 'yyyy-MM-dd');
          const nextDay = format(addDays(startDate, 1), 'yyyy-MM-dd');
          return [startDay, nextDay];
        } else {
          // Bei eintÃ¤gigen EintrÃ¤gen: Nur der Tag selbst
          return [selectedCopyEntry.day];
        }
      } else {
        // Bei normalen EintrÃ¤gen: AusgewÃ¤hlte Tage
        return selectedDays;
      }
    })();
    
    const hasVacationConflict = daysToCheck.some(day => 
      selectedEmployees.some(employeeName => {
        const employee = availableEmployees.find(e => e.name === employeeName);
        return employee && isEmployeeOnVacationOnDay(employee, day);
      })
    );

    // Wenn Zeiten kopieren aktiviert ist und ein Eintrag ausgewÃ¤hlt ist, prÃ¼fe nur die grundlegenden Felder
    if (copyMode && selectedCopyEntry) {
      return (
        selectedEmployees.length > 0 &&
        formData.funktion
      );
    }

    // Wenn Zeiten kopieren aktiviert ist, aber kein Eintrag ausgewÃ¤hlt, prÃ¼fe die grundlegenden Felder
    if (copyMode) {
      return (
        selectedEmployees.length > 0 &&
        formData.funktion &&
        startTime &&
        endTime &&
        selectedCopyEntry !== null
      );
    }

    // Wenn tagÃ¼bergreifend aktiviert ist, prÃ¼fe die ausgewÃ¤hlten Tage und Uhrzeiten
    if (isMultiDay) {
      // Bei kopierten tagÃ¼bergreifenden EintrÃ¤gen sind keine Tage erforderlich, da der Tag aus dem kopierten Eintrag verwendet wird
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
      // Wenn nicht tagÃ¼bergreifend, prÃ¼fe nur die ausgewÃ¤hlten Tage
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

  /**
   * Erstellt die Basis-Parameter fÃ¼r buildTimeEntry aus dem aktuellen Formular-State
   * Wiederverwendbare Funktion fÃ¼r konsistente Entry-Erstellung
   */
  const getBaseEntryParams = useCallback((): Omit<BuildEntryParams, 'name' | 'day' | 'isHoliday'> => {
    let entryStartTime = startTime;
    let entryEndTime = endTime;
    
    // Wenn Zeiten kopieren aktiviert ist und ein Eintrag ausgewÃ¤hlt ist
    if (copyMode && selectedCopyEntry) {
      entryStartTime = selectedCopyEntry.start.slice(11, 16);
      entryEndTime = selectedCopyEntry.ende.slice(11, 16);
    }
    
    const fallbackFunction =
      activeTab === 'external'
        ? getExternalFallbackFunction(externalWorkerFunctions)
        : formData.funktion

    return {
      funktion: fallbackFunction,
      startTime: entryStartTime,
      endTime: entryEndTime,
      pause: formData.pause,
      extra: formData.extra,
      fahrtstunden: formData.fahrtstunden,
      bemerkung: formData.bemerkung,
      isMultiDay,
      isSunday: formData.sonntag,
      initialEntryId: initialEntry?.id
    };
  }, [startTime, endTime, copyMode, selectedCopyEntry, formData, isMultiDay, initialEntry?.id, activeTab, externalWorkerFunctions]);

  /**
   * Bestimmt die zu verwendenden Tage basierend auf copyMode und selectedDays
   */
  const getDaysToUse = useCallback((): string[] => {
    if (copyMode && selectedCopyEntry && selectedDays.length === 0) {
      return [selectedCopyEntry.day];
    }
    return selectedDays;
  }, [copyMode, selectedCopyEntry, selectedDays]);

  /**
   * Optimierte handleSubmit mit paralleler Batch-Verarbeitung
   * Alle Mitarbeiter werden parallel verarbeitet (Promise.all)
   * Jeder Mitarbeiter bekommt alle Tage in EINEM API-Call
   * Jeder Tag hat seinen eigenen Entry mit korrekten Werten (Feiertag, Sonntag, Nachtzuschlag)
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (plausiError) return;
    if (isSubmitting) return; // Doppel-Submit verhindern
    
    setIsSubmitting(true);
    setApiError(null);
    setSubmitProgress({ current: 0, total: activeTab === 'external' ? 1 : selectedEmployees.length });
    
    try {
      const baseParams = getBaseEntryParams();
      const daysToUse = getDaysToUse();
      
      if (daysToUse.length === 0) {
        setApiError('Bitte mindestens einen Tag auswÃ¤hlen.');
        return;
      }

      if (activeTab === 'external') {
        if (!selectedExternalCompany) {
          setApiError('Bitte ein Subunternehmen auswÃ¤hlen.');
          return;
        }
        if (!externalCount || externalCount < 1) {
          setApiError('Bitte eine gÃ¼ltige Mitarbeiteranzahl angeben.');
          return;
        }

        const normalizedExternalFunctions = buildExternalWorkerFunctions(externalCount, externalWorkerFunctions)
        const hasMissingFunction = normalizedExternalFunctions.some(
          (row) => String(row.funktion || '').trim().length === 0
        )
        if (hasMissingFunction) {
          setApiError('Bitte fÃ¼r jeden externen Mitarbeiter eine Funktion auswÃ¤hlen.');
          return;
        }

        const fallbackFunktion = getExternalFallbackFunction(normalizedExternalFunctions)
        const summary = summarizeExternalWorkerFunctions(normalizedExternalFunctions)

        const entries = buildTimeEntriesForDays(
          selectedExternalCompany.name,
          daysToUse,
          baseParams,
          selectedHolidayDays
        ).map((entry) => ({
          ...entry,
          isExternal: true,
          externalCompanyId: selectedExternalCompany.id,
          externalCompanyName: selectedExternalCompany.name,
          externalCount,
          funktion: fallbackFunktion,
          externalWorkerFunctions: normalizedExternalFunctions,
          externalFunctionSummary: summary
        }));

        const payload = entries.map((entry, index) => ({
          day: daysToUse[index],
          entry
        }));

        await onAdd(payload);
        onClose();
        return;
      }

      if (selectedEmployees.length === 0) return;
      
      // Erstelle Tasks fÃ¼r jeden Mitarbeiter - PARALLEL statt SEQUENTIELL
      // Jeder Task macht NUR EINEN API-Call fÃ¼r ALLE Tage
      const tasks = selectedEmployees.map((employeeName) => async () => {
        // Erstellt fÃ¼r JEDEN Tag einen separaten Entry mit korrekten Werten
        // (Feiertag, Sonntagsstunden, Nachtzuschlag werden pro Tag berechnet)
        const entries = buildTimeEntriesForDays(
          employeeName,
          daysToUse,
          baseParams,
          selectedHolidayDays
        );
        
        // Array von {day, entry} fÃ¼r die API erstellen
        const payload = entries.map((entry, index) => ({
          day: daysToUse[index],
          entry
        }));
        
        // EIN API-Call mit ALLEN Tagen und korrekten Entries pro Tag
        await onAdd(payload);
        
        return { employeeName, success: true };
      });
      
      // Parallele AusfÃ¼hrung mit Batch-Processor
      const result = await processBatch(
        tasks,
        selectedEmployees,
        (processed, total) => setSubmitProgress({ current: processed, total })
      );
      
      if (!result.success) {
        // Teilweise Fehler - zeige Bericht
        const errorReport = formatBatchErrorReport(result);
        setApiError(errorReport);
      } else {
        // Alle erfolgreich - Dialog schlieÃŸen
        onClose();
      }
    } catch (err: any) {
      if (err?.response?.status === 409 || err?.message?.includes('bereits im Projekt')) {
        setApiError(err?.response?.data?.error || 'Mitarbeiter ist an einem der Tage bereits eingetragen.');
      } else {
        setApiError('Fehler beim Speichern der ZeiteintrÃ¤ge.');
      }
    } finally {
      setIsSubmitting(false);
      setSubmitProgress({ current: 0, total: 0 });
    }
  };

  // Die Zeiten-kopieren-Checkbox wird nur angezeigt, wenn keine Mitarbeiter ausgewÃ¤hlt sind
  return (
    <div className="overflow-y-auto py-4">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4">
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'internal' | 'external')} className="space-y-4">
            <TabsList className="bg-slate-100 rounded-xl p-1">
              <TabsTrigger value="internal" className="rounded-lg">Interne Mitarbeiter</TabsTrigger>
              <TabsTrigger value="external" className="rounded-lg">Externe Mitarbeiter</TabsTrigger>
            </TabsList>

            <TabsContent value="internal" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-semibold text-slate-700">
                  Mitarbeiter *
                </Label>
                <MultiSelectDropdown
                  label="Mitarbeiter"
                  options={availableEmployees.map(e => e.name)}
                  selected={selectedEmployees}
                  onChange={setSelectedEmployees}
                  placeholder="Mitarbeiter wÃ¤hlen"
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
                    <SelectValue placeholder={selectedEmployees.length === 0 || commonFunctions.length === 0 ? 'Bitte Mitarbeiter wÃ¤hlen' : 'Funktion wÃ¤hlen'} />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {commonFunctions.map(f => (
                      <SelectItem key={f} value={f}>{f}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>

            <TabsContent value="external" className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
                Externe Eintraege werden als ein Eintrag mit Anzahl gespeichert. Stunden und Summen werden mit der Anzahl multipliziert.
                {subcompanies.length === 0 && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                    <span>Lege zuerst ein Subunternehmen an.</span>
                    <Link
                      href="/mitarbeiter?tab=employees&addEmployee=1&employeeTab=external"
                        className="inline-flex items-center gap-1.5 rounded-full bg-blue-600 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm ring-1 ring-blue-500/20 transition hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
                    >
                      <Plus className="h-3 w-3" />
                      Subunternehmen hinzufuegen
                    </Link>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-slate-700">Subunternehmen *</Label>
                <Select value={externalCompanyId} onValueChange={setExternalCompanyId} disabled={subcompanies.length === 0}>
                  <SelectTrigger className="rounded-xl border-slate-200 h-12">
                    <SelectValue placeholder={subcompanies.length === 0 ? 'Keine Subunternehmen vorhanden' : 'Subunternehmen wÃ¤hlen'} />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {subcompanies.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {subcompanies.length === 0 && (
                  <p className="text-xs text-slate-500">Bitte zuerst ein Subunternehmen in der Mitarbeiterseite anlegen.</p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold text-slate-700">Mitarbeiteranzahl *</Label>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  inputMode="numeric"
                  value={externalCount}
                  onChange={(e) => {
                    const value = parseInt(e.target.value, 10);
                    setExternalCount(Number.isFinite(value) && value > 0 ? value : 1);
                  }}
                  className="rounded-xl border-slate-200 focus:border-blue-500 focus:ring-blue-500 h-12"
                />
                {selectedExternalCompany && (
                  <p className="text-xs text-slate-500">Aktuell im Subunternehmen hinterlegt: {selectedExternalCompany.employeeCount} Mitarbeiter.</p>
                )}
              </div>

                            <div className="space-y-2">
                <Label className="text-sm font-semibold text-slate-700">
                  Funktionen der Mitarbeiter *
                </Label>
                <div className="max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-slate-600">Mitarbeiter</th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-600">Funktion</th>
                      </tr>
                    </thead>
                    <tbody>
                      {externalWorkerFunctions.map((row, idx) => (
                        <tr key={`external-worker-${row.workerIndex}`} className="border-t border-slate-100">
                          <td className="px-3 py-2 text-slate-700">Mitarbeiter {row.workerIndex}</td>
                          <td className="px-3 py-2">
                            <Select
                              value={String(row.funktion || '')}
                              onValueChange={(value) =>
                                setExternalWorkerFunctions((prev) =>
                                  prev.map((item, itemIdx) =>
                                    itemIdx === idx
                                      ? { ...item, funktion: value as MitarbeiterFunktion }
                                      : item
                                  )
                                )
                              }
                            >
                              <SelectTrigger className="rounded-xl border-slate-200 h-10">
                                <SelectValue placeholder="Funktion wählen" />
                              </SelectTrigger>
                              <SelectContent className="rounded-xl">
                                {MITARBEITER_FUNKTION_OPTIONS.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {externalWorkerFunctions.some((row) => !String(row.funktion || '').trim()) && (
                  <p className="text-xs text-red-600">
                    Bitte für jeden externen Mitarbeiter eine Funktion auswählen.
                  </p>
                )}
              </div>
            </TabsContent>
          </Tabs>

          {/* Tag-Auswahl direkt unter Funktion */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-slate-700">Einsatztage auswÃ¤hlen *</Label>
            <div className="flex items-center space-x-6 p-3 bg-slate-50 rounded-none mb-2">
              <div className="flex items-center space-x-3">
                <Checkbox 
                  id="selectAllDays"
                  checked={selectAllDays} 
                  onCheckedChange={handleSelectAllDays} 
                  className="rounded"
                />
                <Label htmlFor="selectAllDays" className="text-sm font-medium text-slate-700">
                  Alle Tage auswÃ¤hlen
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
                  TagÃ¼bergreifend
                </Label>
              </div>
              {activeTab !== 'external' && (
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
              )}
            </div>
            {!copyMode && (
              <div className="flex flex-wrap gap-2 p-3 bg-slate-50 rounded-none max-h-32 overflow-y-auto project-times-add">
                {projectDays.map(day => {
                  // PrÃ¼fe, ob der ausgewÃ¤hlte Mitarbeiter an diesem Tag im Urlaub ist
                  const isSelectedEmployeeOnVacation = activeTab === 'external' ? false : selectedEmployees.length > 0 && 
                    selectedEmployees.some(employeeName => {
                      const employee = availableEmployees.find(e => e.name === employeeName);
                      return employee && isEmployeeOnVacationOnDay(employee, day);
                    });
                  
                  // PrÃ¼fe, ob der Tag belegt ist (durch andere EintrÃ¤ge)
                  const isBelegt = activeTab === 'external' ? false : belegteTage.includes(day);
                  
                  // Tag ist disabled wenn: im copyMode und belegt, ODER Mitarbeiter ist im Urlaub
                  const isDisabled = activeTab === 'external' ? false : (copyMode ? isBelegt : isSelectedEmployeeOnVacation);
                  
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
                <Label className="text-xs text-slate-600 mb-1 block">Vorhandene ZeiteintrÃ¤ge auswÃ¤hlen:</Label>
                <Select
                  value={selectedCopyEntry ? getEntryValue(selectedCopyEntry) : ''}
                  onValueChange={val => {
                    const found = kopierbareEintraege.find(e => getEntryValue(e) === val) || allOtherEntries.find(e => getEntryValue(e) === val);
                    setSelectedCopyEntry(found || null);
                  }}
                >
                  <SelectTrigger className="rounded-xl border-slate-200 h-10">
                    <span className="truncate text-xs">
                      {selectedCopyEntry ? getEntryLabel(selectedCopyEntry) : 'Eintrag wÃ¤hlen'}
                    </span>
                  </SelectTrigger>
                  <SelectContent className="rounded-xl max-h-40 overflow-y-auto w-full">
                    {kopierbareEintraege.length === 0 && <div className="px-3 py-2 text-slate-400 text-sm">Keine EintrÃ¤ge vorhanden</div>}
                    {/* Immer auch den aktuell gewÃ¤hlten Eintrag anzeigen, falls nicht in kopierbareEintraege */}
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
                    Zeiten werden aus dem ausgewÃ¤hlten Eintrag Ã¼bernommen:
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
                  <SelectValue placeholder="Pause wÃ¤hlen" />
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
                value={formData.extra}
                onChange={e => {
                  const val = e.target.value;
                  // allow empty or any non-negative integer/float with comma or dot
                  if (val === '' || /^[0-9]+([\.,][0-9]+)?$/.test(val)) {
                    setFormData(prev => ({ ...prev, extra: val }));
                  }
                }}
                placeholder="Extrastunden"
                className="rounded-xl border-slate-200 focus:border-blue-500 focus:ring-blue-500 h-12"
              />
            </div>
          </div>

          {/* Automatische Pausenberechnung */}
          <div className="space-y-3 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-100 dark:border-blue-800">
            <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Checkbox
                id="overrideBreaks"
                checked={overrideBreaks}
                onCheckedChange={(checked) => setOverrideBreaks(!!checked)}
                className="rounded"
              />
              <Label htmlFor="overrideBreaks" className="text-sm font-medium text-slate-700">
                Pausen manuell bearbeiten
              </Label>
            </div>
            </div>

            <BreakSegmentEditor
              breakSegments={breakSegments}
              onChange={(segments) => {
                setBreakSegments(segments)
                setOverrideBreaks(true)
              }}
              disabled={!overrideBreaks}
              showRecalculateButton={overrideBreaks}
              onRecalculate={() => {
                setOverrideBreaks(false)
                calculateBreaksAndPremiums(true, startTime, endTime)
              }}
              isCalculating={false}
              baseDate={selectedDays[0]}
            />
          </div>

          {/* Hinweis wenn Feiertage erkannt wurden */}
          {detectedHolidays.length > 0 && !formData.feiertag && (
            <Alert className="bg-amber-50 border-amber-200 text-amber-800">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <span className="ml-2 text-sm">
                <strong>Feiertag erkannt:</strong> {detectedHolidays.map(d => format(parseISO(d), 'dd.MM.yyyy', { locale: de })).join(', ')} - 
                Bitte Feiertag-Checkbox aktivieren, um FeiertagszuschlÃ¤ge zu berechnen.
              </span>
            </Alert>
          )}

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
                  } else if (detectedHolidays.length > 0) {
                    // Automatisch die erkannten Feiertage vorauswÃ¤hlen
                    setSelectedHolidayDays(detectedHolidays.map(d => format(parseISO(d), 'dd.MM.yyyy', { locale: de })));
                  }
                }}
                className="rounded"
              />
              <Label htmlFor="feiertag" className="text-sm font-medium text-slate-700">Feiertag</Label>
              {detectedHolidays.length > 0 && (
                <span className="text-xs text-amber-600 font-medium">({detectedHolidays.length} erkannt)</span>
              )}
            </div>
            {showHolidayDropdown && (selectedDays.length > 0 || (copyMode && selectedCopyEntry)) && (
              <div className="flex-1">
                <Label className="text-xs text-slate-600 mb-1 block">Feiertage auswÃ¤hlen:</Label>
                <MultiSelectDropdown
                  label=""
                  options={
                    (() => {
                      if (copyMode && selectedCopyEntry) {
                        // Bei kopierten tagÃ¼bergreifenden EintrÃ¤gen: Starttag und Folgetag
                        const startDate = new Date(selectedCopyEntry.start);
                        const endDate = new Date(selectedCopyEntry.ende);
                        const isCrossDay = startDate.toDateString() !== endDate.toDateString();
                        
                        if (isCrossDay) {
                          // Bei tagÃ¼bergreifenden EintrÃ¤gen: Starttag und Folgetag
                          const startDay = format(startDate, 'yyyy-MM-dd');
                          const nextDay = format(addDays(startDate, 1), 'yyyy-MM-dd');
                          return [startDay, nextDay].map(day => format(parseISO(day), 'dd.MM.yyyy', { locale: de }));
                        } else {
                          // Bei eintÃ¤gigen EintrÃ¤gen: Nur der Tag selbst
                          return [selectedCopyEntry.day].map(day => format(parseISO(day), 'dd.MM.yyyy', { locale: de }));
                        }
                      } else {
                        // Normale EintrÃ¤ge: AusgewÃ¤hlte Tage
                        // TagÃ¼bergreifend: AusgewÃ¤hlte Tage + Folgetag(e)
                        if (isMultiDay) {
                          const withNext = selectedDays.flatMap(day => {
                            const next = format(addDays(parseISO(day), 1), 'yyyy-MM-dd');
                            return [day, next];
                          });
                          const unique = Array.from(new Set(withNext));
                          return unique.map(day => format(parseISO(day), 'dd.MM.yyyy', { locale: de }));
                        }
                        return selectedDays.map(day => format(parseISO(day), 'dd.MM.yyyy', { locale: de }));
                      }
                    })()
                  }
                  selected={selectedHolidayDays}
                  onChange={setSelectedHolidayDays}
                  placeholder="Feiertage wÃ¤hlen"
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
            disabled={!isFormValid() || isSubmitting}
            className={`bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-12 px-6 shadow-lg hover:shadow-xl transition-all duration-200 ${(!isFormValid() || isSubmitting) ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                {submitProgress.total > 0 
                  ? `${submitProgress.current}/${submitProgress.total} ${activeTab === 'external' ? 'Eintrag' : 'Mitarbeiter'}...`
                  : 'Wird gespeichert...'}
              </span>
            ) : (
              'HinzufÃ¼gen'
            )}
          </Button>
        </div>
      </form>
      {plausiError && (
        <div className="text-red-600 text-xs mt-1">{plausiError}</div>
      )}
      {/* Anzeige der automatisch berechneten Sonntagsstunden */}
      {(() => {
        if (isMultiDay) return null; // Bei tagÃ¼bergreifenden EintrÃ¤gen nicht anzeigen
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



