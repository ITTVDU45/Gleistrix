"use client";
import React, { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Filter, RefreshCw } from 'lucide-react';
import type { Project, Employee } from '../types';
import MultiSelectDropdown from './ui/MultiSelectDropdown';

interface TimeTrackingFiltersProps {
  projects: Project[];
  employees: Employee[];
  availableLocations: string[];
  selectedProjects: string[];
  setSelectedProjects: (v: string[]) => void;
  selectedEmployees: string[];
  setSelectedEmployees: (v: string[]) => void;
  selectedLocations: string[];
  setSelectedLocations: (v: string[]) => void;
  dateFrom: string;
  setDateFrom: (v: string) => void;
  dateTo: string;
  setDateTo: (v: string) => void;
  searchTerm: string;
  setSearchTerm: (v: string) => void;
}

export default function TimeTrackingFilters({ projects, employees, availableLocations, selectedProjects, setSelectedProjects, selectedEmployees, setSelectedEmployees, selectedLocations, setSelectedLocations, dateFrom, setDateFrom, dateTo, setDateTo, searchTerm, setSearchTerm }: TimeTrackingFiltersProps) {
  // Bedingte Logik: Gefilterte Optionen basierend auf anderen Filtern
  const filteredProjects = React.useMemo(() => {
    let availableProjects = Array.from(new Set(projects.map(p => p.name)));
    
    // Wenn Mitarbeiter ausgewählt sind, zeige nur Projekte mit diesen Mitarbeitern
    if (selectedEmployees.length > 0) {
      const employeeProjects = new Set<string>();
      projects.forEach(project => {
        Object.values(project.mitarbeiterZeiten || {}).flat().forEach((entry: any) => {
          if (selectedEmployees.includes(entry.name)) {
            employeeProjects.add(project.name);
          }
        });
      });
      availableProjects = availableProjects.filter(project => employeeProjects.has(project));
    }
    
    // Wenn Orte ausgewählt sind, zeige nur Projekte mit diesen Orten
    if (selectedLocations.length > 0) {
      const locationProjects = new Set<string>();
      projects.forEach(project => {
        Object.values(project.mitarbeiterZeiten || {}).flat().forEach((entry: any) => {
          if (selectedLocations.includes(entry.ort)) {
            locationProjects.add(project.name);
          }
        });
      });
      availableProjects = availableProjects.filter(project => locationProjects.has(project));
    }
    
    // Wenn Datum ausgewählt ist, zeige nur Projekte mit Einträgen in diesem Zeitraum
    if (dateFrom || dateTo) {
      const dateProjects = new Set<string>();
      projects.forEach(project => {
        Object.entries(project.mitarbeiterZeiten || {}).forEach(([date, entries]) => {
          if ((!dateFrom || date >= dateFrom) && (!dateTo || date <= dateTo)) {
            if (entries.length > 0) {
              dateProjects.add(project.name);
            }
          }
        });
      });
      availableProjects = availableProjects.filter(project => dateProjects.has(project));
    }
    
    return availableProjects;
  }, [projects, selectedEmployees, selectedLocations, dateFrom, dateTo]);

  const filteredEmployees = React.useMemo(() => {
    let availableEmployees = employees.map(e => e.name);
    
    // Wenn Projekte ausgewählt sind, zeige nur Mitarbeiter aus diesen Projekten
    if (selectedProjects.length > 0) {
      const projectEmployees = new Set<string>();
      projects.forEach(project => {
        if (selectedProjects.includes(project.name)) {
          Object.values(project.mitarbeiterZeiten || {}).flat().forEach((entry: any) => {
            projectEmployees.add(entry.name);
          });
        }
      });
      availableEmployees = availableEmployees.filter(employee => projectEmployees.has(employee));
    }
    
    // Wenn Orte ausgewählt sind, zeige nur Mitarbeiter mit Einträgen an diesen Orten
    if (selectedLocations.length > 0) {
      const locationEmployees = new Set<string>();
      projects.forEach(project => {
        Object.values(project.mitarbeiterZeiten || {}).flat().forEach((entry: any) => {
          if (selectedLocations.includes(entry.ort)) {
            locationEmployees.add(entry.name);
          }
        });
      });
      availableEmployees = availableEmployees.filter(employee => locationEmployees.has(employee));
    }
    
    // Wenn Datum ausgewählt ist, zeige nur Mitarbeiter mit Einträgen in diesem Zeitraum
    if (dateFrom || dateTo) {
      const dateEmployees = new Set<string>();
      projects.forEach(project => {
        Object.entries(project.mitarbeiterZeiten || {}).forEach(([date, entries]) => {
          if ((!dateFrom || date >= dateFrom) && (!dateTo || date <= dateTo)) {
            entries.forEach((entry: any) => {
              dateEmployees.add(entry.name);
            });
          }
        });
      });
      availableEmployees = availableEmployees.filter(employee => dateEmployees.has(employee));
    }
    
    return availableEmployees;
  }, [projects, employees, selectedProjects, selectedLocations, dateFrom, dateTo]);

  const filteredLocations = React.useMemo(() => {
    let availableLocs = Array.from(new Set(availableLocations));
    
    // Wenn Projekte ausgewählt sind, zeige nur Orte aus diesen Projekten
    if (selectedProjects.length > 0) {
      const projectLocations = new Set<string>();
      projects.forEach(project => {
        if (selectedProjects.includes(project.name)) {
          Object.values(project.mitarbeiterZeiten || {}).flat().forEach((entry: any) => {
            if (entry.ort && entry.ort !== '-') {
              projectLocations.add(entry.ort);
            }
          });
        }
      });
      availableLocs = availableLocs.filter((location: string) => projectLocations.has(location));
    }
    
    // Wenn Mitarbeiter ausgewählt sind, zeige nur Orte mit diesen Mitarbeitern
    if (selectedEmployees.length > 0) {
      const employeeLocations = new Set<string>();
      projects.forEach(project => {
        Object.values(project.mitarbeiterZeiten || {}).flat().forEach((entry: any) => {
          if (selectedEmployees.includes(entry.name) && entry.ort && entry.ort !== '-') {
            employeeLocations.add(entry.ort);
          }
        });
      });
      availableLocs = availableLocs.filter((location: string) => employeeLocations.has(location));
    }
    
    // Wenn Datum ausgewählt ist, zeige nur Orte mit Einträgen in diesem Zeitraum
    if (dateFrom || dateTo) {
      const dateLocations = new Set<string>();
      projects.forEach(project => {
        Object.entries(project.mitarbeiterZeiten || {}).forEach(([date, entries]) => {
          if ((!dateFrom || date >= dateFrom) && (!dateTo || date <= dateTo)) {
            entries.forEach((entry: any) => {
              if (entry.ort && entry.ort !== '-') {
                dateLocations.add(entry.ort);
              }
            });
          }
        });
      });
      availableLocs = availableLocs.filter((location: string) => dateLocations.has(location));
    }
    
    return availableLocs;
  }, [projects, availableLocations, selectedProjects, selectedEmployees, dateFrom, dateTo]);

  const resetFilters = () => {
    setSearchTerm('');
    setSelectedProjects([]);
    setSelectedEmployees([]);
    setSelectedLocations([]);
    setDateFrom('');
    setDateTo('');
  };

  return (
    <Card className="border-0 shadow-lg bg-white dark:bg-slate-800 rounded-xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-slate-600 dark:text-slate-400" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Filter</h2>
          </div>
          <Button 
            variant="outline" 
            onClick={resetFilters}
            className="flex items-center gap-2 rounded-lg border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 dark:text-white"
          >
            <RefreshCw className="h-4 w-4" />
            Filter zurücksetzen
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-6">
          <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Suche</Label>
            <Input
              placeholder="Suchen..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="rounded-lg border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white [&_[data-badge]]:text-[11px] [&_[data-badge]]:leading-[18px] [&_[data-badge]]:px-2 [&_[data-badge]]:py-0"
            />
          </div>

          <div className="space-y-2">
            <MultiSelectDropdown
              label="Projekt"
              options={filteredProjects}
              selected={selectedProjects}
              onChange={setSelectedProjects}
              placeholder="Projekte wählen"
              renderTagsBelow
            />
          </div>

          <div className="space-y-2">
            <MultiSelectDropdown
              label="Mitarbeiter"
              options={filteredEmployees}
              selected={selectedEmployees}
              onChange={setSelectedEmployees}
              placeholder="Mitarbeiter wählen"
              renderTagsBelow
            />
          </div>

          <div className="space-y-2">
            <MultiSelectDropdown
              label="Ort"
              options={filteredLocations}
              selected={selectedLocations}
              onChange={setSelectedLocations}
              placeholder="Orte wählen"
              renderTagsBelow
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Von</Label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="rounded-lg border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Bis</Label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="rounded-lg border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 