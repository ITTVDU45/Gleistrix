"use client";
import React, { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader } from './ui/card';
import { Table, TableBody, TableCell, TableHeader, TableHead, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Alert, AlertDescription } from './ui/alert';
import { LoadingCard } from './ui/loading';
import { 
  Download, 
  Search, 
  Filter,
  Calendar,
  Clock,
  User,
  Building2,
  FileText,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  MapPin
} from 'lucide-react';
import type { Project, Employee, TimeEntry } from '../types';
import TimeTrackingFilters from './TimeTrackingFilters';
import TimeTrackingExport from './TimeTrackingExport';

interface TimeTrackingClientPageProps {
  projects: Project[];
  employees: Employee[];
}

export default function TimeTrackingClientPage({ projects, employees }: TimeTrackingClientPageProps) {
  // Hilfsfunktion zur Formatierung von Stunden in HH:MM Format
  const formatHours = (hours: number): string => {
    const wholeHours = Math.floor(hours);
    const minutes = Math.round((hours - wholeHours) * 60);
    return `${wholeHours}:${minutes.toString().padStart(2, '0')}`;
  };

  // Alle Zeiteinträge aus allen Projekten sammeln
  const allTimeEntriesRaw: TimeEntry[] = projects.flatMap((project: Project) => 
    Object.entries(project.mitarbeiterZeiten || {}).flatMap(([date, entries]) =>
      entries.map((entry: TimeEntry) => ({
        ...entry,
        projectName: project.name,
        date,
        orderNumber: project.auftragsnummer,
        sapNumber: project.sapNummer,
        client: project.auftraggeber,
         status: project.status as any,
         ort: (project as any).baustelle || '-',
        // ensure Funktion is available under `funktion` (fallbacks from possible keys)
        funktion: (entry as any).funktion || (entry as any).role || (entry as any).position || '-',
        id: `${project.id}-${date}-${entry.id || Math.random()}`
      }))
    )
  );

  // Filtere alle Einträge mit Bemerkung "Fortsetzung vom Vortag" heraus
  const allTimeEntries: TimeEntry[] = allTimeEntriesRaw.filter(entry => !(
    typeof entry.bemerkung === 'string' && entry.bemerkung.includes('Fortsetzung vom Vortag')
  ));

  // Sortiere die Einträge: Neueste (nach Datum und Uhrzeit) zuerst
  allTimeEntries.sort((a, b) => {
    // Erst nach Datum absteigend
    const dateA = new Date(`${a.date}T${a.start || '00:00'}`);
    const dateB = new Date(`${b.date}T${b.start || '00:00'}`);
    return dateB.getTime() - dateA.getTime();
  });

  const getTotalHours = () => {
    return allTimeEntries.reduce((sum: number, entry: any) => sum + entry.stunden, 0);
  };

  const getTotalTravelHours = () => {
    return allTimeEntries.reduce((sum: number, entry: any) => sum + entry.fahrtstunden, 0);
  };

  // Filter-States im Page-Component
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Verfügbare Orte für Filter
  const availableLocations = React.useMemo(() => {
    return Array.from(new Set(allTimeEntries.map(entry => entry.ort).filter(ort => ort && ort !== '-')));
  }, [allTimeEntries]);

  // Gefilterte Einträge
  const filteredEntries: TimeEntry[] = allTimeEntries.filter(entry => {
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

      {/* Statistik-Karten */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-4">
        <Card className="border-0 shadow-lg bg-white dark:bg-slate-800 rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Einträge</p>
                <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{allTimeEntries.length}</p>
              </div>
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-white dark:bg-slate-800 rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600 dark:text-green-400">Arbeitsstunden</p>
                <p className="text-2xl font-bold text-green-900 dark:text-green-100">{formatHours(getTotalHours())}</p>
              </div>
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-xl">
                <Clock className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-white dark:bg-slate-800 rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-600 dark:text-purple-400">Fahrtstunden</p>
                <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">{formatHours(getTotalTravelHours())}</p>
              </div>
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
                <User className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-white dark:bg-slate-800 rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-orange-600 dark:text-orange-400">Projekte</p>
                <p className="text-2xl font-bold text-orange-900 dark:text-orange-100">
                  {new Set(allTimeEntries.map((e: any) => e.projectName)).size}
                </p>
              </div>
              <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-xl">
                <Building2 className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
            </div>
          </CardContent>
        </Card>
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
      <Card className="border-0 shadow-lg bg-white dark:bg-slate-800 rounded-xl">
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
            <div className="rounded-xl border border-slate-200 dark:border-slate-600 overflow-hidden">
              <Table>
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
                          <div>
                            <p className="text-slate-900 dark:text-slate-100">{entry.name}</p>
                            <p className="text-sm text-slate-500 dark:text-slate-500">{entry.funktion || (entry as any).role || '-'}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                          <span className="text-slate-700 dark:text-slate-300">
                            {entry.start} - {entry.ende}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono rounded-lg">
                          {formatHours(entry.stunden)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-slate-600 dark:text-slate-400">
                          {entry.pause ? `${entry.pause}h` : '-'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-slate-600 dark:text-slate-400">
                          {entry.nachtzulage !== undefined && entry.nachtzulage !== null && entry.nachtzulage !== '' ?
                            parseFloat(entry.nachtzulage).toFixed(2) + 'h' :
                            '-'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-slate-600 dark:text-slate-400">
                          {entry.sonntag !== undefined && entry.sonntag !== null && entry.sonntag !== '' ?
                            parseFloat(entry.sonntag).toFixed(2) + 'h' :
                            '-'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-slate-600 dark:text-slate-400">
                          {entry.feiertag !== undefined && entry.feiertag !== null && entry.feiertag !== '' ?
                            parseFloat(entry.feiertag).toFixed(2) + 'h' :
                            '-'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-slate-600 dark:text-slate-400">
                          {entry.fahrtstunden > 0 ? `${entry.fahrtstunden}h` : '-'}
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