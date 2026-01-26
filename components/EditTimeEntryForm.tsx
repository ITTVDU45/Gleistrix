"use client";
import React from 'react'
import { Input } from './ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Button } from './ui/button'
import type { Project, TimeEntry, MitarbeiterFunktion, Employee } from '../types'
import type { BreakSegment } from '@/lib/timeEntry'
import { calculateRequiredBreakMinutes, calculateBreakSegments } from '@/lib/timeEntry'
import { format, parseISO, addDays } from 'date-fns'
import { de } from 'date-fns/locale'
import { Checkbox } from './ui/checkbox'
import { Label } from './ui/label'
import { useProjects } from '../hooks/useProjects'
import { Alert } from './ui/alert'
import { AlertCircle, Loader2 } from 'lucide-react'
import MultiSelectDropdown from './ui/MultiSelectDropdown'
import { BreakSegmentEditor } from './BreakSegmentEditor'

// Typen für Multi-Day Edit
export interface MultiDayEditData {
  updates: Array<{ day: string; entryId: string; entry: TimeEntry }>;
  newEntries: Array<{ day: string; entry: TimeEntry }>;
}

interface EditTimeEntryFormProps {
  project: Project
  selectedDate: string
  entry: TimeEntry
  onEdit: (data: MultiDayEditData) => Promise<void> | void
  onClose: () => void
  employees?: Employee[]
}

export function EditTimeEntryForm({ project, selectedDate, entry, onEdit, onClose, employees = [] }: EditTimeEntryFormProps) {
  // Extrahiere 'HH:mm' aus möglichen ISO- oder Zeitstrings
  function extractTime(value: any): string {
    if (!value) return '';
    const str = String(value);
    if (/^\d{2}:\d{2}$/.test(str)) return str;
    if (str.includes('T')) {
      const t = str.split('T')[1] || '';
      return t.slice(0, 5);
    }
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      return `${hh}:${mm}`;
    }
    return '';
  }

  const [formData, setFormData] = React.useState({
    name: entry.name,
    funktion: entry.funktion,
    start: extractTime((entry as any).start),
    ende: extractTime((entry as any).ende),
    pause: entry.pause,
    extra: entry.extra.toString(),
    fahrtstunden: entry.fahrtstunden.toString(),
    feiertag: entry.feiertag === 1,
    sonntag: entry.sonntag === 1,
    bemerkung: entry.bemerkung
  })

  const { projects: allProjects } = useProjects();
  const [apiError, setApiError] = React.useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  // Automatische Pausenberechnung States
  const [autoBreakEnabled, setAutoBreakEnabled] = React.useState(true)
  const [breakSegments, setBreakSegments] = React.useState<BreakSegment[]>(entry.breakSegments || [])

  function isEmployeeAssignedElsewhere(employeeName: string, day: string, currentProjectId: string, projects: Project[], ownEntryId?: string): boolean {
    return projects.some(p => {
      if (p.id === currentProjectId) return false;
      if (!p.mitarbeiterZeiten || !p.mitarbeiterZeiten[day]) return false;
      return p.mitarbeiterZeiten[day].some((entry: any) => entry.name === employeeName && entry.id !== ownEntryId);
    });
  }

  // Prüfe, ob ein Mitarbeiter an einem der ausgewählten Tage bereits eingetragen ist (projektübergreifend, außer beim eigenen Eintrag)
  function isEmployeeBlockedGlobally(employee: Employee): boolean {
    return selectedDays.some(day =>
      allProjects.some(p =>
        p.mitarbeiterZeiten?.[day]?.some((e: any) => e.name === employee.name && e.id !== entry.id)
      )
    );
  }

  // Gibt den Namen des Projekts zurück, in dem der Mitarbeiter an einem der ausgewählten Tage eingetragen ist (außer beim eigenen Eintrag)
  function getBlockingProjectName(employee: Employee): string | null {
    for (const day of selectedDays) {
      for (const p of allProjects) {
        if (p.mitarbeiterZeiten?.[day]?.some((e: any) => e.name === employee.name && e.id !== entry.id)) {
          return p.name;
        }
      }
    }
    return null;
  }

  // Projekttage berechnen
  const projectDays = React.useMemo(() => {
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

  const [selectedDays, setSelectedDays] = React.useState<string[]>([selectedDate])
  const [selectAllDays, setSelectAllDays] = React.useState(false)
  const [isMultiDay, setIsMultiDay] = React.useState(false)
  const [showHolidayDropdown, setShowHolidayDropdown] = React.useState(false)
  const [selectedHolidayDays, setSelectedHolidayDays] = React.useState<string[]>([])

  // Automatische Pausenberechnung bei Start/Ende-Änderung (rein lokal)
  React.useEffect(() => {
    if (!autoBreakEnabled) return
    if (!formData.start || !formData.ende) return

    const day = selectedDate || projectDays[0]
    if (!day) return

    let endDay = day
    const isOvernight = formData.ende < formData.start
    if (isOvernight) {
      endDay = format(addDays(parseISO(day), 1), 'yyyy-MM-dd')
    }

    const startISO = `${day}T${formData.start}`
    const endISO = `${endDay}T${formData.ende}`

    const totalDurationMinutes = (new Date(endISO).getTime() - new Date(startISO).getTime()) / (1000 * 60)
    const requiredBreakMinutes = calculateRequiredBreakMinutes(totalDurationMinutes)
    const localBreaks = calculateBreakSegments(startISO, endISO, requiredBreakMinutes)
    setBreakSegments(localBreaks)

    // Pause im Formular aktualisieren
    const localBreakTotalMinutes = localBreaks.reduce((sum, seg) => {
      const segStart = new Date(seg.start)
      const segEnd = new Date(seg.end)
      return sum + (segEnd.getTime() - segStart.getTime()) / (1000 * 60)
    }, 0)
    const pauseHours = localBreakTotalMinutes / 60
    const pauseStr = pauseHours.toFixed(2).replace('.', ',')
    setFormData(prev => ({ ...prev, pause: pauseStr }))
  }, [formData.start, formData.ende, autoBreakEnabled, selectedDate, projectDays])

  // Alle Tage auswählen
  const handleSelectAllDays = (checked: boolean) => {
    setSelectAllDays(checked)
    if (checked) {
      setSelectedDays(projectDays.filter(day => {
        if (!formData.name) return false;
        return !isEmployeeAssignedElsewhere(formData.name, day, project.id, allProjects, entry.id);
      }))
    } else {
      setSelectedDays([])
    }
  }

  // Synchronisiere selectAllDays-Checkbox wenn manuell alle Tage ausgewählt werden
  React.useEffect(() => {
    const availableDays = projectDays.filter(day => {
      if (!formData.name) return true;
      return !isEmployeeAssignedElsewhere(formData.name, day, project.id, allProjects, entry.id);
    });
    const allSelected = availableDays.length > 0 && availableDays.every(day => selectedDays.includes(day));
    setSelectAllDays(allSelected);
  }, [selectedDays, projectDays, formData.name, project.id, allProjects, entry.id]);

  // State für Kopierfunktion
  const [copyMode, setCopyMode] = React.useState(false);
  const [selectedCopyEntry, setSelectedCopyEntry] = React.useState<any | null>(null);

  // Alle bisherigen Zeiteinträge anderer Mitarbeiter (außer aktuelle Auswahl)
  const allOtherEntries = React.useMemo(() => {
    const entries: any[] = [];
    Object.entries(project.mitarbeiterZeiten || {}).forEach(([day, arr]: any) => {
      (arr || []).forEach((e: any) => {
        if (e.name !== formData.name && e.id !== entry.id) {
          entries.push({ ...e, day });
        }
      });
    });
    return entries;
  }, [project.mitarbeiterZeiten, formData.name, entry.id]);

  // Wenn ein Eintrag ausgewählt wird, übernehme Tage und Zeiten
  React.useEffect(() => {
    if (selectedCopyEntry) {
      setFormData(prev => ({
        ...prev,
        start: selectedCopyEntry.start,
        ende: selectedCopyEntry.ende,
        pause: selectedCopyEntry.pause,
        fahrtstunden: selectedCopyEntry.fahrtstunden?.toString() || '',
      }));
      setSelectedDays([selectedCopyEntry.day]);
    }
  }, [selectedCopyEntry]);

  // Synchronisiere selectedHolidayDays wenn sich selectedDays ändert
  React.useEffect(() => {
    if (showHolidayDropdown) {
      // Entferne Feiertags-Tage, die nicht mehr verfügbar sind
      setSelectedHolidayDays(prev => 
        prev.filter(holidayDay => {
          const holidayDate = holidayDay.split('.').reverse().join('-'); // Konvertiere dd.MM.yyyy zu yyyy-MM-dd
          let availableDays: string[];
          
          // Bei tagübergreifenden Einträgen: Starttag und Folgetag
          if (isMultiDay) {
            const withNext = selectedDays.flatMap(day => {
              const next = format(addDays(parseISO(day), 1), 'yyyy-MM-dd');
              return [day, next];
            });
            availableDays = Array.from(new Set(withNext));
          } else {
            availableDays = selectedDays;
          }
          
          return availableDays.includes(holidayDate);
        })
      );
    }
  }, [selectedDays, showHolidayDropdown, isMultiDay]);

  // Hilfsfunktion: Berechne Stunden zwischen zwei Zeitpunkten (inkl. Datum, auch über Mitternacht, in lokaler Zeit)
  function calculateHoursForDay(startISO: string, endISO: string): number {
    const startDate = new Date(startISO);
    const endDate = new Date(endISO);
    return (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
  }

  // Hilfsfunktion für Nachtzulage (23:00-06:00), arbeitet mit ISO-Strings in lokaler Zeit
  // Die Pause wird proportional von den Nachtstunden abgezogen
  function calculateNightBonus(startISO: string, endISO: string, pause: string): number {
    const startDate = new Date(startISO);
    const endDate = new Date(endISO);
    let totalNightMinutes = 0;
    let totalWorkMinutes = 0;
    let current = new Date(startDate);
    
    while (current < endDate) {
      const hour = current.getHours();
      const minute = current.getMinutes();
      const minutesOfDay = hour * 60 + minute;
      totalWorkMinutes++;
      // Nachtzeit: 23:00-24:00 oder 0:00-6:00
      if (minutesOfDay >= 23 * 60 || minutesOfDay < 6 * 60) {
        totalNightMinutes++;
      }
      current.setMinutes(current.getMinutes() + 1);
    }
    
    // Pause proportional von den Nachtstunden abziehen
    // Wenn z.B. 20% der Arbeitszeit Nachtzeit ist, werden 20% der Pause von Nachtstunden abgezogen
    const pauseNum = parseFloat((pause || '0').replace(',', '.')) || 0;
    if (totalWorkMinutes > 0) {
      const nightRatio = totalNightMinutes / totalWorkMinutes;
      const pauseInNight = pauseNum * 60 * nightRatio;
      totalNightMinutes = Math.max(0, totalNightMinutes - pauseInNight);
    }
    
    return totalNightMinutes / 60;
  }

  // Hilfsfunktion: Sind alle Pflichtfelder ausgefüllt?
  function isFormValid() {
    return (
      formData.name &&
      formData.funktion &&
      formData.start &&
      formData.ende &&
      selectedDays.length > 0
    );
  }

  // Pausenoptionen 0, 0,25, 0,5, 0,75, ... 12 (0,25 Schritte)
  const pauseOptions = React.useMemo(() => {
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

  // Hilfsfunktion: Finde existierenden Eintrag des Mitarbeiters an einem Tag
  function findExistingEntryForDay(day: string): { id: string; entry: any } | null {
    const entriesForDay = project.mitarbeiterZeiten?.[day] || [];
    const found = entriesForDay.find((e: any) => e.name === formData.name);
    return found ? { id: found.id, entry: found } : null;
  }

  // Erstelle einen TimeEntry für einen spezifischen Tag
  function buildEntryForDay(day: string, existingId?: string): TimeEntry {
    const startISO = `${day}T${formData.start}`;
    // Wenn die Endzeit < Startzeit ist, ist es über Mitternacht → Endtag = Folgetag
    let endDay = day;
    if (formData.ende < formData.start || isMultiDay) {
      const nextDay = addDays(parseISO(day), 1);
      endDay = format(nextDay, 'yyyy-MM-dd');
    }
    const endISO = `${endDay}T${formData.ende}`;
    const totalHours = calculateHoursForDay(startISO, endISO) - (parseFloat(formData.pause.replace(',', '.')) || 0);
    
    // Berechne Feiertagsstunden basierend auf selectedHolidayDays für diesen Tag
    let feiertagsStunden: number = 0;
    if (formData.feiertag && selectedHolidayDays.length > 0) {
      const dayFormatted = format(parseISO(day), 'dd.MM.yyyy', { locale: de });
      const endDayFormatted = format(parseISO(endDay), 'dd.MM.yyyy', { locale: de });
      const isStartDayHoliday = selectedHolidayDays.includes(dayFormatted);
      const isEndDayHoliday = day !== endDay && selectedHolidayDays.includes(endDayFormatted);
      
      if (day === endDay) {
        if (isStartDayHoliday) {
          feiertagsStunden = Math.round(totalHours);
        }
      } else {
        if (isStartDayHoliday) {
          const startDate = new Date(startISO);
          const endOfDay = new Date(day + 'T23:59:59');
          feiertagsStunden += Math.round((endOfDay.getTime() - startDate.getTime()) / (1000 * 60 * 60));
        }
        if (isEndDayHoliday) {
          const startOfNextDay = new Date(endDay + 'T00:00:00');
          const endDate = new Date(endISO);
          feiertagsStunden += Math.round((endDate.getTime() - startOfNextDay.getTime()) / (1000 * 60 * 60));
        }
      }
    }

    // Sonntagsstunden berechnen
    const startDate = new Date(startISO);
    const endDate = new Date(endISO);
    let sonntagsstunden = 0;
    if (formData.sonntag) {
      let current = new Date(startDate);
      let sundayMinutes = 0;
      while (current < endDate) {
        if (current.getDay() === 0) { // Sonntag
          sundayMinutes++;
        }
        current.setMinutes(current.getMinutes() + 1);
      }
      sonntagsstunden = sundayMinutes / 60;
    }
    
    return {
      id: existingId || `${Date.now().toString()}-${formData.name}-${day}`,
      name: formData.name,
      funktion: formData.funktion,
      start: startISO,
      ende: endISO,
      stunden: totalHours,
      pause: formData.pause,
      extra: parseFloat(formData.extra.replace(',', '.')) || 0,
      fahrtstunden: parseFloat(formData.fahrtstunden.replace(',', '.')) || 0,
      feiertag: feiertagsStunden,
      sonntag: formData.sonntag ? 1 : 0,
      sonntagsstunden,
      bemerkung: formData.bemerkung,
      nachtzulage: calculateNightBonus(startISO, endISO, formData.pause).toString()
    } as TimeEntry;
  }

  // Im handleSubmit: Für jeden ausgewählten Tag einen Entry erstellen
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setApiError(null);

    try {
      const updates: Array<{ day: string; entryId: string; entry: TimeEntry }> = [];
      const newEntries: Array<{ day: string; entry: TimeEntry }> = [];

      for (const day of selectedDays) {
        const existing = findExistingEntryForDay(day);
        
        if (existing) {
          // Existierender Eintrag -> Update
          const updatedEntry = buildEntryForDay(day, existing.id);
          updates.push({ day, entryId: existing.id, entry: updatedEntry });
        } else {
          // Kein Eintrag -> Neu erstellen
          const newEntry = buildEntryForDay(day);
          newEntries.push({ day, entry: newEntry });
        }
      }

      await onEdit({ updates, newEntries });
      onClose();
    } catch (err: any) {
      if (err?.response?.status === 409 || err?.message?.includes('bereits im Projekt')) {
        setApiError(err?.response?.data?.error || 'Mitarbeiter ist an einem der Tage bereits eingetragen.');
      } else {
        setApiError('Fehler beim Speichern der Zeiteinträge.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name" className="text-sm font-semibold text-slate-700">
            Mitarbeiter *
          </Label>
          <Select value={formData.name} onValueChange={(value) => setFormData(prev => ({ ...prev, name: value }))}>
            <SelectTrigger className="rounded-xl border-slate-200 focus:border-blue-500 focus:ring-blue-500 h-12">
              <SelectValue placeholder="Mitarbeiter wählen" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              {employees.map((employee) => {
                const blocked = isEmployeeBlockedGlobally(employee);
                const blockingProject = blocked ? getBlockingProjectName(employee) : null;
                return (
                  <SelectItem
                    key={employee.id}
                    value={employee.name}
                    disabled={blocked}
                    className={blocked ? 'opacity-50 pointer-events-none bg-slate-100' : ''}
                  >
                    {employee.name}
                    {blocked && blockingProject && (
                      <span className="ml-2 text-xs text-slate-500">(eingetragen im Projekt: {blockingProject})</span>
                    )}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="funktion" className="text-sm font-semibold text-slate-700">
            Funktion *
          </Label>
          <Select value={formData.funktion} onValueChange={(value) => setFormData(prev => ({ ...prev, funktion: value as MitarbeiterFunktion }))}>
            <SelectTrigger className="rounded-xl border-slate-200 focus:border-blue-500 focus:ring-blue-500 h-12">
              <SelectValue placeholder="Funktion wählen" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="SIPO">SIPO</SelectItem>
              <SelectItem value="HFE">HFE</SelectItem>
              <SelectItem value="Monteur/bediener">Monteur/bediener</SelectItem>
              <SelectItem value="Sakra">Sakra</SelectItem>
              <SelectItem value="BüP">BüP</SelectItem>
              <SelectItem value="HiBa">HiBa</SelectItem>
              <SelectItem value="SAS">SAS</SelectItem>
              <SelectItem value="Bahnerder">Bahnerder</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="start" className="text-sm font-semibold text-slate-700">
              Startzeit *
            </Label>
            <Input
              id="start"
              type="time"
              value={formData.start}
              onChange={(e) => setFormData(prev => ({ ...prev, start: e.target.value }))}
              className="rounded-xl border-slate-200 focus:border-blue-500 focus:ring-blue-500 h-12"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ende" className="text-sm font-semibold text-slate-700">
              Endzeit *
            </Label>
            <Input
              id="ende"
              type="time"
              value={formData.ende}
              onChange={(e) => setFormData(prev => ({ ...prev, ende: e.target.value }))}
              className="rounded-xl border-slate-200 focus:border-blue-500 focus:ring-blue-500 h-12"
              required
            />
          </div>
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
              Extra (1-20)
            </Label>
            <Input
              id="extra"
              type="number"
              value={formData.extra}
              onChange={e => {
                const val = e.target.value;
                if (val === '' || /^[0-9]+([\.,][0-9]+)?$/.test(val)) {
                  setFormData(prev => ({ ...prev, extra: val }));
                }
              }}
              placeholder="Zahl"
              className="rounded-xl border-slate-200 focus:border-blue-500 focus:ring-blue-500 h-12"
            />
          </div>
        </div>

        {/* Automatische Pausenberechnung Anzeige */}
        {breakSegments.length > 0 && (
          <div className="space-y-3 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-100 dark:border-blue-800">
            <BreakSegmentEditor
              breakSegments={breakSegments}
              onChange={(segments) => {
                setBreakSegments(segments)
                setAutoBreakEnabled(false)
              }}
              disabled={autoBreakEnabled}
              baseDate={selectedDays[0]}
            />
          </div>
        )}

        <div className="flex gap-6 p-3 bg-slate-50 rounded-xl flex-wrap items-start">
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
          {showHolidayDropdown && selectedDays.length > 0 && (
            <div className="flex-1 min-w-[250px]">
              <Label className="text-xs text-slate-600 mb-1 block">Feiertage auswählen:</Label>
              <MultiSelectDropdown
                label=""
                options={
                  (() => {
                    // Bei tagübergreifenden Einträgen: Starttag und Folgetag
                    if (isMultiDay) {
                      const withNext = selectedDays.flatMap(day => {
                        const next = format(addDays(parseISO(day), 1), 'yyyy-MM-dd');
                        return [day, next];
                      });
                      const unique = Array.from(new Set(withNext));
                      return unique.map(day => format(parseISO(day), 'dd.MM.yyyy', { locale: de }));
                    }
                    return selectedDays.map(day => format(parseISO(day), 'dd.MM.yyyy', { locale: de }));
                  })()
                }
                selected={selectedHolidayDays}
                onChange={setSelectedHolidayDays}
                placeholder="Feiertage wählen"
              />
            </div>
          )}
          <div className="flex items-center space-x-3">
            <Checkbox
              id="sonntag"
              checked={formData.sonntag}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, sonntag: checked as boolean }))}
              className="rounded"
            />
            <Label htmlFor="sonntag" className="text-sm font-medium text-slate-700">Sonntag</Label>
          </div>
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

        {apiError && (
          <Alert variant="destructive" className="rounded-xl border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4" />
            <span>{apiError}</span>
          </Alert>
        )}

        <div className="flex items-center gap-6">
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
              id="selectAllDays"
              checked={selectAllDays} 
              onCheckedChange={(checked) => handleSelectAllDays(!!checked)} 
              className="rounded"
            />
            <Label htmlFor="selectAllDays" className="text-sm font-medium text-slate-700">
              Alle Tage auswählen ({projectDays.length})
            </Label>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 p-3 bg-slate-50 rounded-xl max-h-32 overflow-y-auto">
          {projectDays.map(day => {
            const assignedElsewhere = formData.name && isEmployeeAssignedElsewhere(formData.name, day, project.id, allProjects, entry.id);
            return (
              <Button
                key={day}
                type="button"
                variant={selectedDays.includes(day) ? 'default' : 'outline'}
                size="sm"
                disabled={!!assignedElsewhere}
                className={`rounded-xl transition-all duration-200 ${
                  assignedElsewhere
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : selectedDays.includes(day)
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'border-slate-200 hover:bg-slate-100'
                }`}
                onClick={() => !assignedElsewhere && setSelectedDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])}
              >
                {format(parseISO(day), 'dd.MM.yyyy', { locale: de })}
              </Button>
            );
          })}
        </div>
        {/* Zeiten kopieren Checkbox und Auswahl */}
        <div className="flex items-center space-x-3 mt-2">
          <Checkbox id="copyMode" checked={copyMode} onCheckedChange={checked => setCopyMode(!!checked)} className="rounded" />
          <Label htmlFor="copyMode" className="text-sm font-medium text-slate-700">Zeiten kopieren</Label>
        </div>
        {copyMode && (
          <div className="mt-2">
            <Label className="text-xs text-slate-600 mb-1 block">Vorhandene Zeiteinträge auswählen:</Label>
            <Select value={selectedCopyEntry?.id || ''} onValueChange={id => setSelectedCopyEntry(allOtherEntries.find(e => e.id === id))}>
              <SelectTrigger className="rounded-xl border-slate-200 h-10">
                <SelectValue placeholder="Eintrag wählen" />
              </SelectTrigger>
              <SelectContent className="rounded-xl max-h-60 overflow-y-auto">
                {allOtherEntries.length === 0 && <div className="px-3 py-2 text-slate-400 text-sm">Keine Einträge vorhanden</div>}
                {allOtherEntries.map(e => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name} | {e.funktion} | {e.day} | {e.start} - {e.ende}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="flex gap-3 justify-end pt-4 border-t border-slate-100">
        <Button 
          variant="outline" 
          onClick={onClose}
          disabled={isSubmitting}
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
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Speichern...
            </>
          ) : (
            <>Speichern {selectedDays.length > 1 ? `(${selectedDays.length} Tage)` : ''}</>
          )}
        </Button>
      </div>
    </form>
  )
} 