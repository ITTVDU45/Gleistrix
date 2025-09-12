'use client';
import React from 'react';
import { Card, CardContent, CardHeader } from './ui/card';
import { Table, TableBody, TableCell, TableHeader, TableHead, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { Calendar, Clock, User, Building2, MapPin, FileText } from 'lucide-react';
import type { Project, Employee, TimeEntry } from '../types';
import TimeTrackingFilters from './TimeTrackingFilters';
import TimeTrackingExport from './TimeTrackingExport';
import DynamicTimeTrackingStats from './DynamicTimeTrackingStats';

interface TimeTrackingWithFilterProps {
  projects: Project[];
  employees: Employee[];
}

export default function TimeTrackingWithFilter({ projects, employees }: TimeTrackingWithFilterProps) {
  // Hilfsfunktion zur Formatierung von Stunden in HH:MM Format
  const formatHoursDot = (value: any): string => {
    const num = typeof value === 'number' ? value : parseFloat(String(value).replace(',', '.'));
    if (Number.isNaN(num)) return '-';
    const whole = Math.floor(num);
    const minutes = Math.round((num - whole) * 60);
    return `${whole}.${String(minutes).padStart(2, '0')}`;
  };

  // Zeitformatierung wie in Projektdetails: bei tagübergreifend Datum+Uhrzeit, sonst nur Uhrzeit
  const formatZeit = (start: string, ende: string): string => {
    if (!start || !ende) return start || ende || '-';
    const sIso = String(start);
    const eIso = String(ende);
    const hasIso = sIso.includes('T') && eIso.includes('T');
    const sDay = hasIso ? sIso.slice(0, 10) : '';
    const eDay = hasIso ? eIso.slice(0, 10) : '';
    if (hasIso && sDay !== eDay) {
      const d = (iso: string) => {
        const dt = new Date(iso);
        const dd = String(dt.getDate()).padStart(2, '0');
        const mm = String(dt.getMonth() + 1).padStart(2, '0');
        const yyyy = dt.getFullYear();
        const hh = String(dt.getHours()).padStart(2, '0');
        const mi = String(dt.getMinutes()).padStart(2, '0');
        return `${dd}.${mm}.${yyyy} ${hh}:${mi}`;
      };
      return `${d(sIso)} - ${d(eIso)}`;
    }
    const s = sIso.includes('T') ? sIso.slice(11, 16) : sIso;
    const e = eIso.includes('T') ? eIso.slice(11, 16) : eIso;
    return `${s} - ${e}`;
  };

  // Alle Zeiteinträge aus allen Projekten sammeln
  const allTimeEntriesRaw = projects.flatMap((project: Project) => 
    Object.entries(project.mitarbeiterZeiten || {}).flatMap(([date, entries]) =>
      entries.map((entry: TimeEntry) => ({
        // explicitly map known fields so downstream components always receive them
        id: `${project.id}-${date}-${entry.id || Math.random()}`,
        projectName: project.name,
        date,
        orderNumber: project.auftragsnummer,
        sapNumber: project.sapNummer,
        client: project.auftraggeber,
        status: project.status as any,
        ort: (project as any).baustelle || '-',
        name: entry.name || (entry as any).mitarbeiter || '-',
        funktion: entry.funktion || (entry as any).role || '-',
        start: entry.start || (entry as any).beginn || '-',
        ende: entry.ende || (entry as any).end || '-',
        stunden: typeof entry.stunden === 'number' ? entry.stunden : (parseFloat(String(entry.stunden || 0)) || 0),
        pause: entry.pause || '-',
        nachtzulage: (entry as any).nachtzulage !== undefined ? (entry as any).nachtzulage : ((entry as any).nachtstunden !== undefined ? (entry as any).nachtstunden : 0),
        // Bevorzuge explizite Sonntagsstunden; fallback auf evtl. numerisches sonntag-Feld
        sonntagsstunden: (entry as any).sonntagsstunden !== undefined
          ? (entry as any).sonntagsstunden
          : (entry as any).sonntag !== undefined
            ? (typeof (entry as any).sonntag === 'number' ? (entry as any).sonntag : parseFloat(String((entry as any).sonntag)) || 0)
            : 0,
        feiertag: entry.feiertag !== undefined ? entry.feiertag : 0,
        fahrtstunden: entry.fahrtstunden !== undefined ? entry.fahrtstunden : ((entry as any).fahrt || 0),
        extra: entry.extra || (entry as any).extraInfo || '-',
        bemerkung: entry.bemerkung || entry.note || '',
      }))
    )
  );

  // Filtere alle Einträge mit Bemerkung "Fortsetzung vom Vortag" heraus
  const allTimeEntries = allTimeEntriesRaw.filter(entry => !(
    typeof entry.bemerkung === 'string' && entry.bemerkung.includes('Fortsetzung vom Vortag')
  ));

  // Sortiere die Einträge: Neueste (nach Datum und Uhrzeit) zuerst
  allTimeEntries.sort((a, b) => {
    // Erst nach Datum absteigend
    const dateA = new Date(`${a.date}T${a.start || '00:00'}`);
    const dateB = new Date(`${b.date}T${b.start || '00:00'}`);
    return dateB.getTime() - dateA.getTime();
  });

  // Filter-States
  const [selectedProjects, setSelectedProjects] = React.useState<string[]>([]);
  const [selectedEmployees, setSelectedEmployees] = React.useState<string[]>([]);
  const [selectedLocations, setSelectedLocations] = React.useState<string[]>([]);
  const [dateFrom, setDateFrom] = React.useState('');
  const [dateTo, setDateTo] = React.useState('');
  const [searchTerm, setSearchTerm] = React.useState('');

  // Verfügbare Orte für Filter
  const availableLocations = React.useMemo(() => {
    return Array.from(new Set(allTimeEntries.map(entry => entry.ort).filter(ort => ort && ort !== '-')));
  }, [allTimeEntries]);

  // Gefilterte Einträge
  const filteredEntries = React.useMemo(() => {
    return allTimeEntries.filter(entry => {
      if (selectedProjects.length > 0 && !selectedProjects.includes(entry.projectName)) return false;
      if (selectedEmployees.length > 0 && !selectedEmployees.includes(entry.name)) return false;
      if (selectedLocations.length > 0 && !selectedLocations.includes(entry.ort)) return false;
      if (dateFrom && entry.date < dateFrom) return false;
      if (dateTo && entry.date > dateTo) return false;
      if (searchTerm && !(
        entry.projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (entry.client && entry.client.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (entry.ort && entry.ort.toLowerCase().includes(searchTerm.toLowerCase()))
      )) return false;
      return true;
    });
  }, [allTimeEntries, selectedProjects, selectedEmployees, selectedLocations, dateFrom, dateTo, searchTerm]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Zeiterfassung</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">Übersicht aller Zeiteinträge</p>
        </div>
        <TimeTrackingExport timeEntries={filteredEntries} />
      </div>

      {/* Dynamische Statistik-Karten */}
      <div className="timetracking-cards">
        <DynamicTimeTrackingStats timeEntries={filteredEntries} />
      </div>

      {/* Filter-Bereich */}
      <TimeTrackingFilters
        projects={projects}
        employees={employees}
        availableLocations={availableLocations}
        selectedProjects={selectedProjects}
        setSelectedProjects={setSelectedProjects}
        selectedEmployees={selectedEmployees}
        setSelectedEmployees={setSelectedEmployees}
        selectedLocations={selectedLocations}
        setSelectedLocations={setSelectedLocations}
        dateFrom={dateFrom}
        setDateFrom={setDateFrom}
        dateTo={dateTo}
        setDateTo={setDateTo}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
      />

      {/* Zeiteinträge-Tabelle */}
      <Card className="border-0 shadow-lg bg-white dark:bg-slate-800 rounded-xl timetracking-table">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Zeiteinträge</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                {filteredEntries.length} Einträge
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredEntries.length > 0 ? (
            <div className="rounded-xl border border-slate-200 dark:border-slate-600 overflow-auto">
              <Table className="min-w-[1200px]">
                <TableHeader>
                  <TableRow className="bg-slate-50 dark:bg-slate-700">
                    <TableHead className="font-medium text-slate-700 dark:text-slate-300">Datum</TableHead>
                    <TableHead className="font-medium text-slate-700 dark:text-slate-300">Projektname</TableHead>
                    <TableHead className="font-medium text-slate-700 dark:text-slate-300">Ort</TableHead>
                    <TableHead className="font-medium text-slate-700 dark:text-slate-300">Mitarbeiter</TableHead>
                    <TableHead className="font-medium text-slate-700 dark:text-slate-300">Zeit</TableHead>
                    <TableHead className="font-medium text-slate-700 dark:text-slate-300">Gesamtstunden</TableHead>
                    <TableHead className="font-medium text-slate-700 dark:text-slate-300">Pause</TableHead>
                    <TableHead className="font-medium text-slate-700 dark:text-slate-300">Nachtstunden</TableHead>
                    <TableHead className="font-medium text-slate-700 dark:text-slate-300">Sonntagsstunden</TableHead>
                    <TableHead className="font-medium text-slate-700 dark:text-slate-300">Feiertagsstunden</TableHead>
                    <TableHead className="font-medium text-slate-700 dark:text-slate-300">Fahrtstunden</TableHead>
                    <TableHead className="font-medium text-slate-700 dark:text-slate-300">Extra</TableHead>
                    <TableHead className="font-medium text-slate-700 dark:text-slate-300">Projektstatus</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEntries.map((entry: any) => (
                    <TableRow key={entry.id} className="hover:bg-slate-50 dark:hover:bg-slate-700">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                          <span className="text-slate-700 dark:text-slate-300">
                            {new Date(entry.date).toLocaleDateString('de-DE')}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                          <div>
                            <p className="font-medium text-slate-900 dark:text-slate-100">{entry.projectName}</p>
                            <p className="text-sm text-slate-500 dark:text-slate-500">{entry.client}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                          <span className="text-slate-700 dark:text-slate-300">{entry.ort}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                          <span className="text-slate-700 dark:text-slate-300">{entry.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                          <span className="text-slate-700 dark:text-slate-300">
                            {formatZeit(entry.start, entry.ende)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono rounded-lg">
                          {formatHoursDot(entry.stunden)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-slate-600 dark:text-slate-400">
                          {(() => {
                            const p = typeof entry.pause === 'number' ? entry.pause : parseFloat(String(entry.pause).replace(',', '.'));
                            return Number.isFinite(p) && p > 0 ? `${formatHoursDot(p)}h` : '-';
                          })()}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-slate-600 dark:text-slate-400">
                          {entry.nachtzulage !== undefined && entry.nachtzulage !== null && entry.nachtzulage !== '' ?
                            formatHoursDot(entry.nachtzulage) + 'h' :
                            '-'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-slate-600 dark:text-slate-400">
                          {entry.sonntagsstunden !== undefined && entry.sonntagsstunden !== null && entry.sonntagsstunden !== '' ?
                            formatHoursDot(entry.sonntagsstunden) + 'h' :
                            '-'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-slate-600 dark:text-slate-400">
                          {entry.feiertag !== undefined && entry.feiertag !== null && entry.feiertag !== '' ?
                            formatHoursDot(entry.feiertag) + 'h' :
                            '-'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-slate-600 dark:text-slate-400">
                          {entry.fahrtstunden > 0 ? `${formatHoursDot(entry.fahrtstunden)}h` : '-'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-slate-600 dark:text-slate-400">
                          {entry.extra || '-'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-green-100 text-green-800 rounded-lg">
                          {entry.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-600">Keine Zeiteinträge vorhanden</p>
              <p className="text-sm text-slate-500 mt-1">Erstellen Sie Ihren ersten Zeiteintrag</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 