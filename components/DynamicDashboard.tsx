'use client';
import React from 'react';
import { ArrowUpRight, Building2, Users, Clock, Car, Calendar, Target, CheckCircle, Archive } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardHeader } from './ui/card';
import { Table, TableBody, TableCell, TableHeader, TableHead, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Button } from './ui/button';
import type { Project, Employee, Vehicle } from '../types';

interface DynamicDashboardProps {
  projects: Project[];
  employees: Employee[];
  vehicles: Vehicle[];
}

export default function DynamicDashboard({ projects, employees, vehicles }: DynamicDashboardProps) {
  // Hilfsfunktion: Aktueller Monat als YYYY-MM Format
  const getCurrentMonth = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  };

  // Hilfsfunktion: Monatsoptionen generieren
  const getMonthOptions = () => {
    const options = [];
    const currentYear = new Date().getFullYear();
    const monthNames = [
      'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
      'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
    ];
    
    // Generiere Optionen für aktuelle und vorherige Jahre
    for (let year = currentYear + 1; year >= currentYear - 2; year--) {
      for (let month = 1; month <= 12; month++) {
        const monthStr = String(month).padStart(2, '0');
        const value = `${year}-${monthStr}`;
        const label = `${monthNames[month - 1]} ${year}`;
        options.push({ value, label });
      }
    }
    return options;
  };

  const [selectedMonth, setSelectedMonth] = React.useState(getCurrentMonth());

  // Dynamische Berechnungen basierend auf ausgewähltem Monat
  const dashboardData = React.useMemo(() => {
    const [year, month] = selectedMonth.split('-');
    const startDate = `${year}-${month}-01`;
    const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
    const endDate = `${year}-${month}-${lastDay}`;

    // Projekte im ausgewählten Monat
    const projectsInMonth = projects.filter(project => {
      // Prüfe, ob das Projekt im Monat aktiv ist
      const projectStart = new Date(project.datumBeginn);
      const projectEnd = new Date(project.datumEnde);
      const monthStart = new Date(startDate);
      const monthEnd = new Date(endDate);
      
      return projectStart <= monthEnd && projectEnd >= monthStart;
    });

    // Aktive Projekte (Status: aktiv)
    const activeProjects = projectsInMonth.filter(project => project.status === 'aktiv').length;

    // Abgeschlossene Projekte (Status: abgeschlossen, fertiggestellt, geleistet)
    const completedProjects = projectsInMonth.filter(project => 
      ['abgeschlossen', 'fertiggestellt', 'geleistet'].includes(project.status)
    ).length;

    // Gesamtprojekte
    const totalProjects = projectsInMonth.length;

    // Mitarbeiter im ausgewählten Monat (mit Einsätzen)
    const employeesInMonth = new Set<string>();
    projects.forEach(project => {
      Object.entries(project.mitarbeiterZeiten || {}).forEach(([date, entries]) => {
        if (date >= startDate && date <= endDate) {
          entries.forEach(entry => {
            employeesInMonth.add(entry.name);
          });
        }
      });
    });

    // Gesamtstunden im ausgewählten Monat
    const totalHours = projects.reduce((sum, project) => {
      return sum + Object.entries(project.mitarbeiterZeiten || {}).reduce((projectSum, [date, entries]) => {
        if (date >= startDate && date <= endDate) {
          return projectSum + entries.reduce((entrySum, entry) => entrySum + entry.stunden, 0);
        }
        return projectSum;
      }, 0);
    }, 0);

    // Fahrzeuge im ausgewählten Monat
    const vehiclesInMonth = new Set<string>();
    projects.forEach(project => {
      Object.entries(project.fahrzeuge || {}).forEach(([date, vehiclesForDay]) => {
        if (date >= startDate && date <= endDate) {
          vehiclesForDay.forEach(vehicle => {
            vehiclesInMonth.add(vehicle.id || `${vehicle.type} ${vehicle.licensePlate}`);
          });
        }
      });
    });

    return {
      activeProjects,
      completedProjects,
      totalProjects,
      employeesInMonth: employeesInMonth.size,
      totalHours,
      vehiclesInMonth: vehiclesInMonth.size
    };
  }, [projects, selectedMonth]);

  return (
    <>
      {/* Monats-Auswahl */}
      <Card className="border-0 shadow-lg bg-white dark:bg-slate-800 rounded-xl my-6">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-slate-600 dark:text-slate-400" />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Zeitraum:</span>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-48 rounded-lg border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {getMonthOptions().map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Badge variant="secondary" className="text-xs">
              Dynamische Daten
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Statistik-Karten */}
      <div className="grid gap-6 grid-cols-[repeat(auto-fit,minmax(220px,1fr))] my-8">
        {/* Aktive Projekte */}
        <Card className="border-0 shadow-lg bg-white dark:bg-slate-800 rounded-xl my-4 h-full min-h-[160px]">
          <CardContent className="p-5 sm:p-6 h-full">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Aktive Projekte</p>
                <p className="text-3xl sm:text-4xl font-bold text-blue-900 dark:text-blue-100 mt-2">{dashboardData.activeProjects}</p>
                <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                  {dashboardData.activeProjects === 1 ? 'Aktives Projekt' : 'Aktive Projekte'}
                </p>
              </div>
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                <Target className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Abgeschlossene Projekte */}
        <Card className="border-0 shadow-lg bg-white dark:bg-slate-800 rounded-xl my-4 h-full min-h-[160px]">
          <CardContent className="p-5 sm:p-6 h-full">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600 dark:text-green-400">Abgeschlossene</p>
                <p className="text-3xl sm:text-4xl font-bold text-green-900 dark:text-green-100 mt-2">{dashboardData.completedProjects}</p>
                <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                  {dashboardData.completedProjects === 1 ? 'Abgeschlossenes Projekt' : 'Abgeschlossene Projekte'}
                </p>
              </div>
              <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-xl">
                <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Projekte Gesamt */}
        <Card className="border-0 shadow-lg bg-white dark:bg-slate-800 rounded-xl my-4 h-full min-h-[160px]">
          <CardContent className="p-5 sm:p-6 h-full">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-600 dark:text-purple-400">Projekte Gesamt</p>
                <p className="text-3xl sm:text-4xl font-bold text-purple-900 dark:text-purple-100 mt-2">{dashboardData.totalProjects}</p>
                <p className="text-sm text-purple-600 dark:text-purple-400 mt-1">
                  {dashboardData.totalProjects === 1 ? 'Projekt' : 'Projekte'}
                </p>
              </div>
              <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
                <Archive className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Mitarbeiter */}
        <Card className="border-0 shadow-lg bg-white dark:bg-slate-800 rounded-xl my-4 h-full min-h-[160px]">
          <CardContent className="p-5 sm:p-6 h-full">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400">Mitarbeiter</p>
                <p className="text-3xl sm:text-4xl font-bold text-indigo-900 dark:text-indigo-100 mt-2">{dashboardData.employeesInMonth}</p>
                <p className="text-sm text-indigo-600 dark:text-indigo-400 mt-1">
                  {dashboardData.employeesInMonth === 1 ? 'Aktiver Mitarbeiter' : 'Aktive Mitarbeiter'}
                </p>
              </div>
              <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl">
                <Users className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Gesamtstunden */}
        <Card className="border-0 shadow-lg bg-white dark:bg-slate-800 rounded-xl my-4 h-full min-h-[160px]">
          <CardContent className="p-5 sm:p-6 h-full">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-orange-600 dark:text-orange-400">Gesamtstunden</p>
                <p className="text-3xl sm:text-4xl font-bold text-orange-900 dark:text-orange-100 mt-2">{dashboardData.totalHours.toFixed(1)}h</p>
                <p className="text-sm text-orange-600 dark:text-orange-400 mt-1">Geleistete Stunden</p>
              </div>
              <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-xl">
                <Clock className="h-6 w-6 text-orange-600 dark:text-orange-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Fahrzeuge */}
        <Card className="border-0 shadow-lg bg-white dark:bg-slate-800 rounded-xl my-4 h-full min-h-[160px]">
          <CardContent className="p-5 sm:p-6 h-full">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-red-600 dark:text-red-400">Fahrzeuge</p>
                <p className="text-3xl sm:text-4xl font-bold text-red-900 dark:text-red-100 mt-2">{dashboardData.vehiclesInMonth}</p>
                <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                  {dashboardData.vehiclesInMonth === 1 ? 'Eingesetztes Fahrzeug' : 'Eingesetzte Fahrzeuge'}
                </p>
              </div>
              <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-xl">
                <Car className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Aktuelle Projekte */}
      <Card className="border-0 shadow-lg bg-white dark:bg-slate-800 rounded-xl my-8">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Aktuelle Projekte</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Die neuesten aktiven Projekte</p>
            </div>
            <Button asChild variant="outline" size="sm" className="rounded-lg border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 dark:text-white">
              <Link href="/projekte" className="flex items-center gap-2">
                Alle Projekte
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {(() => {
            const sortedActiveProjects = projects
              .filter((project: Project) => project.status === 'aktiv')
              .sort((a: Project, b: Project) => new Date(b.datumBeginn).getTime() - new Date(a.datumBeginn).getTime())
              .slice(0, 5);

            return sortedActiveProjects.length > 0 ? (
              <div className="rounded-xl border border-slate-200 dark:border-slate-600 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 dark:bg-slate-700">
                      <TableHead className="font-medium text-slate-700 dark:text-slate-300">Projekt</TableHead>
                      <TableHead className="font-medium text-slate-700 dark:text-slate-300">Auftraggeber</TableHead>
                      <TableHead className="font-medium text-slate-700 dark:text-slate-300">Baustelle</TableHead>
                      <TableHead className="font-medium text-slate-700 dark:text-slate-300 text-right">Aktion</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedActiveProjects.map((project: Project) => (
                      <TableRow key={project.id} className="hover:bg-slate-50 dark:hover:bg-slate-700">
                        <TableCell className="font-medium dark:text-white">{project.name}</TableCell>
                        <TableCell className="dark:text-slate-300">{project.auftraggeber}</TableCell>
                        <TableCell className="dark:text-slate-300">{project.baustelle}</TableCell>
                        <TableCell className="text-right">
                          <Button asChild variant="ghost" size="sm" className="rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400">
                            <Link href={`/projektdetail/${project.id}`} className="flex items-center gap-2">
                              Details
                              <ArrowUpRight className="h-4 w-4" />
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-12">
                <Building2 className="h-12 w-12 text-slate-400 dark:text-slate-500 mx-auto mb-4" />
                <p className="text-slate-600 dark:text-slate-400">Keine aktiven Projekte</p>
                <p className="text-sm text-slate-500 dark:text-slate-500 mt-1">Erstellen Sie Ihr erstes Projekt</p>
              </div>
            );
          })()}
        </CardContent>
      </Card>
    </>
  );
} 