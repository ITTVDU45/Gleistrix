"use client";
import React, { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader } from './ui/card';
import { ChevronDown, ChevronUp, Filter, RefreshCw } from 'lucide-react';
import type { Project } from '../types';
import MultiSelectDropdown from './ui/MultiSelectDropdown';

interface TimeTrackingFiltersProps {
  projects: Project[];
  employeeOptions: string[];
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

export default function TimeTrackingFilters({ projects, employeeOptions, availableLocations, selectedProjects, setSelectedProjects, selectedEmployees, setSelectedEmployees, selectedLocations, setSelectedLocations, dateFrom, setDateFrom, dateTo, setDateTo, searchTerm, setSearchTerm }: TimeTrackingFiltersProps) {
  const [isCollapsed, setIsCollapsed] = useState(true);

  const getEntryEmployeeName = (entry: any): string => {
    if (entry?.isExternal) {
      return String(entry.externalCompanyName || entry.name || '').trim();
    }
    return String(entry?.name || '').trim();
  };

  const filteredProjects = React.useMemo(() => {
    let availableProjects = Array.from(new Set(projects.map(p => p.name)));

    if (selectedEmployees.length > 0) {
      const employeeProjects = new Set<string>();
      projects.forEach(project => {
        Object.values(project.mitarbeiterZeiten || {}).flat().forEach((entry: any) => {
          const entryName = getEntryEmployeeName(entry);
          if (entryName && selectedEmployees.includes(entryName)) {
            employeeProjects.add(project.name);
          }
        });
      });
      availableProjects = availableProjects.filter(project => employeeProjects.has(project));
    }

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
    let availableEmployees = employeeOptions;

    if (selectedProjects.length > 0) {
      const projectEmployees = new Set<string>();
      projects.forEach(project => {
        if (selectedProjects.includes(project.name)) {
          Object.values(project.mitarbeiterZeiten || {}).flat().forEach((entry: any) => {
            const entryName = getEntryEmployeeName(entry);
            if (entryName) projectEmployees.add(entryName);
          });
        }
      });
      availableEmployees = availableEmployees.filter(employee => projectEmployees.has(employee));
    }

    if (selectedLocations.length > 0) {
      const locationEmployees = new Set<string>();
      projects.forEach(project => {
        Object.values(project.mitarbeiterZeiten || {}).flat().forEach((entry: any) => {
          if (selectedLocations.includes(entry.ort)) {
            const entryName = getEntryEmployeeName(entry);
            if (entryName) locationEmployees.add(entryName);
          }
        });
      });
      availableEmployees = availableEmployees.filter(employee => locationEmployees.has(employee));
    }

    if (dateFrom || dateTo) {
      const dateEmployees = new Set<string>();
      projects.forEach(project => {
        Object.entries(project.mitarbeiterZeiten || {}).forEach(([date, entries]) => {
          if ((!dateFrom || date >= dateFrom) && (!dateTo || date <= dateTo)) {
            entries.forEach((entry: any) => {
              const entryName = getEntryEmployeeName(entry);
              if (entryName) dateEmployees.add(entryName);
            });
          }
        });
      });
      availableEmployees = availableEmployees.filter(employee => dateEmployees.has(employee));
    }

    return availableEmployees;
  }, [projects, employeeOptions, selectedProjects, selectedLocations, dateFrom, dateTo]);

  const filteredLocations = React.useMemo(() => {
    let availableLocs = Array.from(new Set(availableLocations));

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

    if (selectedEmployees.length > 0) {
      const employeeLocations = new Set<string>();
      projects.forEach(project => {
        Object.values(project.mitarbeiterZeiten || {}).flat().forEach((entry: any) => {
          const entryName = getEntryEmployeeName(entry);
          if (entryName && selectedEmployees.includes(entryName) && entry.ort && entry.ort !== '-') {
            employeeLocations.add(entry.ort);
          }
        });
      });
      availableLocs = availableLocs.filter((location: string) => employeeLocations.has(location));
    }

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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-slate-600 dark:text-slate-400" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Filter</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              type="button"
              onClick={() => setIsCollapsed((prev) => !prev)}
              className="flex items-center gap-2 rounded-lg border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 dark:text-white"
              aria-expanded={!isCollapsed}
              aria-controls="timetracking-filter-panel"
            >
              {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
              {isCollapsed ? 'Filter anzeigen' : 'Filter einklappen'}
            </Button>
            <Button
              variant="outline"
              onClick={resetFilters}
              className="flex items-center gap-2 rounded-lg border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 dark:text-white"
            >
              <RefreshCw className="h-4 w-4" />
              Filter zuruecksetzen
            </Button>
          </div>
        </div>
      </CardHeader>
      {!isCollapsed && (
        <CardContent id="timetracking-filter-panel">
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
                placeholder="Projekte waehlen"
                renderTagsBelow
              />
            </div>

            <div className="space-y-2">
              <MultiSelectDropdown
                label="Mitarbeiter"
                options={filteredEmployees}
                selected={selectedEmployees}
                onChange={setSelectedEmployees}
                placeholder="Mitarbeiter waehlen"
                renderTagsBelow
              />
            </div>

            <div className="space-y-2">
              <MultiSelectDropdown
                label="Ort"
                options={filteredLocations}
                selected={selectedLocations}
                onChange={setSelectedLocations}
                placeholder="Orte waehlen"
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
      )}
    </Card>
  );
}
