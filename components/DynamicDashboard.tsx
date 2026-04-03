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

type StatCard = {
  label: string
  value: string | number
  helper: string
  icon: typeof Target
  tone: string
  iconShell: string
  accent: string
}

export default function DynamicDashboard({ projects, employees, vehicles }: DynamicDashboardProps) {
  const getCurrentMonth = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  };

  const getMonthOptions = () => {
    const options = [];
    const currentYear = new Date().getFullYear();
    const monthNames = [
      'Januar', 'Februar', 'Maerz', 'April', 'Mai', 'Juni',
      'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
    ];

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

  const dashboardData = React.useMemo(() => {
    const [year, month] = selectedMonth.split('-');
    const startDate = `${year}-${month}-01`;
    const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
    const endDate = `${year}-${month}-${lastDay}`;

    const projectsInMonth = projects.filter(project => {
      const projectStart = new Date(project.datumBeginn);
      const projectEnd = new Date(project.datumEnde);
      const monthStart = new Date(startDate);
      const monthEnd = new Date(endDate);
      return projectStart <= monthEnd && projectEnd >= monthStart;
    });

    const activeProjects = projectsInMonth.filter(project => project.status === 'aktiv').length;
    const completedProjects = projectsInMonth.filter(project =>
      ['abgeschlossen', 'fertiggestellt', 'geleistet'].includes(project.status)
    ).length;
    const totalProjects = projectsInMonth.length;

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

    const totalHours = projects.reduce((sum, project) => {
      return sum + Object.entries(project.mitarbeiterZeiten || {}).reduce((projectSum, [date, entries]) => {
        if (date >= startDate && date <= endDate) {
          return projectSum + entries.reduce((entrySum, entry) => entrySum + entry.stunden, 0);
        }
        return projectSum;
      }, 0);
    }, 0);

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

  const statCards: StatCard[] = [
    {
      label: 'Aktive Projekte',
      value: dashboardData.activeProjects,
      helper: dashboardData.activeProjects === 1 ? 'Aktives Projekt' : 'Aktive Projekte',
      icon: Target,
      tone: 'text-blue-600',
      iconShell: 'bg-blue-50 ring-blue-100',
      accent: 'from-blue-500 via-sky-400 to-cyan-300',
    },
    {
      label: 'Abgeschlossen',
      value: dashboardData.completedProjects,
      helper: dashboardData.completedProjects === 1 ? 'Abgeschlossenes Projekt' : 'Abgeschlossene Projekte',
      icon: CheckCircle,
      tone: 'text-emerald-600',
      iconShell: 'bg-emerald-50 ring-emerald-100',
      accent: 'from-emerald-500 via-lime-400 to-green-300',
    },
    {
      label: 'Projekte Gesamt',
      value: dashboardData.totalProjects,
      helper: dashboardData.totalProjects === 1 ? 'Projekt' : 'Projekte',
      icon: Archive,
      tone: 'text-fuchsia-600',
      iconShell: 'bg-fuchsia-50 ring-fuchsia-100',
      accent: 'from-fuchsia-500 via-violet-400 to-purple-300',
    },
    {
      label: 'Mitarbeiter',
      value: dashboardData.employeesInMonth,
      helper: dashboardData.employeesInMonth === 1 ? 'Aktiver Mitarbeiter' : 'Aktive Mitarbeiter',
      icon: Users,
      tone: 'text-indigo-600',
      iconShell: 'bg-indigo-50 ring-indigo-100',
      accent: 'from-indigo-500 via-blue-400 to-sky-300',
    },
    {
      label: 'Gesamtstunden',
      value: `${dashboardData.totalHours.toFixed(1)}h`,
      helper: 'Geleistete Stunden',
      icon: Clock,
      tone: 'text-amber-600',
      iconShell: 'bg-amber-50 ring-amber-100',
      accent: 'from-amber-500 via-orange-400 to-yellow-300',
    },
    {
      label: 'Fahrzeuge',
      value: dashboardData.vehiclesInMonth,
      helper: dashboardData.vehiclesInMonth === 1 ? 'Eingesetztes Fahrzeug' : 'Eingesetzte Fahrzeuge',
      icon: Car,
      tone: 'text-rose-600',
      iconShell: 'bg-rose-50 ring-rose-100',
      accent: 'from-rose-500 via-red-400 to-orange-300',
    },
  ];

  return (
    <>
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 my-8">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card
              key={card.label}
              className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/70 ring-1 ring-white"
            >
              <CardContent className="p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${card.tone}`}>{card.label}</p>
                    <p className="mt-3 text-3xl font-semibold text-slate-900">{card.value}</p>
                    <p className={`mt-2 text-sm ${card.tone}`}>{card.helper}</p>
                  </div>
                  <div className={`rounded-2xl p-3 ring-1 ${card.iconShell}`}>
                    <Icon className={`h-5 w-5 ${card.tone}`} />
                  </div>
                </div>
                <div className={`mt-5 h-1.5 rounded-full bg-gradient-to-r ${card.accent}`} />
              </CardContent>
            </Card>
          );
        })}
      </div>

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
