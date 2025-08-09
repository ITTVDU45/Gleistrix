"use client";
import React from 'react'
import { Input } from './ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Button } from './ui/button'
import type { Project, TimeEntry, MitarbeiterFunktion, Employee } from '../types'
import { format, parseISO, addDays } from 'date-fns'
import { de } from 'date-fns/locale'
import { Checkbox } from './ui/checkbox'
import { Label } from './ui/label'
import { useProjects } from '../hooks/useProjects'
import { Alert } from './ui/alert'
import { AlertCircle } from 'lucide-react'

interface EditTimeEntryFormProps {
  project: Project
  selectedDate: string
  entry: TimeEntry
  onEdit: (date: string, entry: TimeEntry) => void
  onClose: () => void
  employees?: Employee[]
}

export function EditTimeEntryForm({ project, selectedDate, entry, onEdit, onClose, employees = [] }: EditTimeEntryFormProps) {
  const [formData, setFormData] = React.useState({
    name: entry.name,
    funktion: entry.funktion,
    start: entry.start,
    ende: entry.ende,
    pause: entry.pause,
    extra: entry.extra.toString(),
    fahrtstunden: entry.fahrtstunden.toString(),
    feiertag: entry.feiertag === 1,
    sonntag: entry.sonntag === 1,
    bemerkung: entry.bemerkung
  })

  const { projects: allProjects } = useProjects();
  const [apiError, setApiError] = React.useState<string | null>(null)

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
      if (minutesOfDay >= 23 * 60 || minutesOfDay < 6 * 60) {
        totalNightMinutes++;
      }
      current.setMinutes(current.getMinutes() + 1);
    }
    const pauseNum = parseFloat((pause || '0').replace(',', '.')) || 0;
    totalNightMinutes = Math.max(0, totalNightMinutes - pauseNum * 60);
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

  const pauseOptions = ['0,5', '1', '1,5', '2', '2,5', '3', '3,5', '4', '4,5', '5', '5,5', '6', '6,5', '7', '7,5', '8', '8,5', '9', '9,5', '10'];

  // Im handleSubmit: Berechne Stunden und Nachtzuschlag mit vollständigen ISO-Strings
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // Hole das Datum aus selectedDays[0] (bzw. selectedDate)
    const day = selectedDays[0] || selectedDate;
    const startISO = `${day}T${formData.start}`;
    // Wenn die Endzeit < Startzeit ist, ist es über Mitternacht → Endtag = Folgetag
    let endDay = day;
    if (formData.ende < formData.start) {
      const idx = projectDays.indexOf(day);
      if (idx !== -1 && idx + 1 < projectDays.length) {
        endDay = projectDays[idx + 1];
      }
    }
    const endISO = `${endDay}T${formData.ende}`;
    const totalHours = calculateHoursForDay(startISO, endISO) - (parseFloat(formData.pause.replace(',', '.')) || 0);
    const updatedEntry: TimeEntry = {
      ...entry,
      name: formData.name,
      funktion: formData.funktion,
      start: startISO,
      ende: endISO,
      stunden: totalHours,
      pause: formData.pause,
      extra: parseFloat(formData.extra.replace(',', '.')) || 0,
      fahrtstunden: parseFloat(formData.fahrtstunden.replace(',', '.')) || 0,
      feiertag: formData.feiertag ? 1 : 0,
      sonntag: formData.sonntag ? 1 : 0,
      bemerkung: formData.bemerkung,
      nachtzulage: calculateNightBonus(startISO, endISO, formData.pause).toString()
    }
    try {
      onEdit(selectedDate, updatedEntry)
      setApiError(null)
      onClose()
    } catch (err: any) {
      if (err?.response?.status === 409 || err?.message?.includes('bereits im Projekt')) {
        setApiError(err?.response?.data?.error || 'Mitarbeiter ist an einem der Tage bereits eingetragen.');
      } else {
        setApiError('Fehler beim Speichern des Zeiteintrags.');
      }
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
              min={1}
              max={20}
              value={formData.extra}
              onChange={e => {
                const val = e.target.value;
                if (val === '' || (/^\d+$/.test(val) && +val >= 1 && +val <= 20)) {
                  setFormData(prev => ({ ...prev, extra: val }));
                }
              }}
              placeholder="Zahl 1-20"
              className="rounded-xl border-slate-200 focus:border-blue-500 focus:ring-blue-500 h-12"
            />
          </div>
        </div>

        <div className="flex gap-6 p-3 bg-slate-50 rounded-xl">
          <div className="flex items-center space-x-3">
            <Checkbox
              id="feiertag"
              checked={formData.feiertag}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, feiertag: checked as boolean }))}
              className="rounded"
            />
            <Label htmlFor="feiertag" className="text-sm font-medium text-slate-700">Feiertag</Label>
          </div>
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
          className="rounded-xl h-12 px-6 border-slate-200 hover:bg-slate-50"
        >
          Abbrechen
        </Button>
        <Button 
          type="submit"
          disabled={!isFormValid()}
          className={`bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-12 px-6 shadow-lg hover:shadow-xl transition-all duration-200 ${!isFormValid() ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          Speichern
        </Button>
      </div>
    </form>
  )
} 