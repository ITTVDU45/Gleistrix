"use client";
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Filter, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import MultiSelectDropdown from './ui/MultiSelectDropdown';

interface EmployeeAssignment {
  id: string;
  datum: string;
  projektName: string;
  funktion: string;
  stunden: number;
  fahrtstunden: number;
  fahrzeuge?: string[];
}

interface EmployeeAssignmentFilterProps {
  assignments: EmployeeAssignment[];
  onFilterChange: (filteredAssignments: EmployeeAssignment[]) => void;
}

export default function EmployeeAssignmentFilter({ assignments, onFilterChange }: EmployeeAssignmentFilterProps) {
  // Filter States
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [selectedFunctions, setSelectedFunctions] = useState<string[]>([]);
  const [selectedVehicles, setSelectedVehicles] = useState<string[]>([]);

  // Ref für den letzten gefilterten Wert
  const lastFilteredRef = useRef<EmployeeAssignment[]>([]);

  // Monate für Dropdown generieren
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    assignments.forEach(assignment => {
      const date = new Date(assignment.datum);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      months.add(monthKey);
    });
    return Array.from(months).sort().reverse();
  }, [assignments]);

  // Alle verfügbaren Optionen
  const allAvailableOptions = useMemo(() => {
    const allProjects = Array.from(new Set(assignments.map(a => a.projektName)));
    const allFunctions = Array.from(new Set(assignments.map(a => a.funktion)));
    const allVehicles = Array.from(new Set(
      assignments.flatMap(a => a.fahrzeuge || [])
    ));

    return {
      projects: allProjects,
      functions: allFunctions,
      vehicles: allVehicles
    };
  }, [assignments]);

  // Bedingte Logik: Gefilterte Optionen basierend auf anderen Filtern
  const filteredProjects = useMemo(() => {
    let availableProjects = Array.from(new Set(assignments.map(a => a.projektName)));
    
    // Wenn Funktionen ausgewählt sind, zeige nur Projekte mit diesen Funktionen
    if (selectedFunctions.length > 0) {
      const functionProjects = new Set<string>();
      assignments.forEach(assignment => {
        if (selectedFunctions.includes(assignment.funktion)) {
          functionProjects.add(assignment.projektName);
        }
      });
      availableProjects = availableProjects.filter(project => functionProjects.has(project));
    }
    
    // Wenn Fahrzeuge ausgewählt sind, zeige nur Projekte mit diesen Fahrzeugen
    if (selectedVehicles.length > 0) {
      const vehicleProjects = new Set<string>();
      assignments.forEach(assignment => {
        if (assignment.fahrzeuge?.some(vehicle => selectedVehicles.includes(vehicle))) {
          vehicleProjects.add(assignment.projektName);
        }
      });
      availableProjects = availableProjects.filter(project => vehicleProjects.has(project));
    }
    
    // Wenn Zeitraum ausgewählt ist, zeige nur Projekte mit Einsätzen in diesem Zeitraum
    if (selectedMonth !== 'all' || dateFrom || dateTo) {
      const dateProjects = new Set<string>();
      assignments.forEach(assignment => {
        const assignmentDate = new Date(assignment.datum);
        let includeAssignment = true;
        
        if (selectedMonth !== 'all') {
          const [year, month] = selectedMonth.split('-');
          includeAssignment = assignmentDate.getFullYear() === parseInt(year) && 
                           assignmentDate.getMonth() === parseInt(month) - 1;
        }
        
        if (dateFrom && includeAssignment) {
          includeAssignment = assignment.datum >= dateFrom;
        }
        
        if (dateTo && includeAssignment) {
          includeAssignment = assignment.datum <= dateTo;
        }
        
        if (includeAssignment) {
          dateProjects.add(assignment.projektName);
        }
      });
      availableProjects = availableProjects.filter(project => dateProjects.has(project));
    }
    
    return availableProjects;
  }, [assignments, selectedFunctions, selectedVehicles, selectedMonth, dateFrom, dateTo]);

  const filteredFunctions = useMemo(() => {
    let availableFunctions = Array.from(new Set(assignments.map(a => a.funktion)));
    
    // Wenn Projekte ausgewählt sind, zeige nur Funktionen aus diesen Projekten
    if (selectedProjects.length > 0) {
      const projectFunctions = new Set<string>();
      assignments.forEach(assignment => {
        if (selectedProjects.includes(assignment.projektName)) {
          projectFunctions.add(assignment.funktion);
        }
      });
      availableFunctions = availableFunctions.filter(func => projectFunctions.has(func));
    }
    
    // Wenn Fahrzeuge ausgewählt sind, zeige nur Funktionen mit diesen Fahrzeugen
    if (selectedVehicles.length > 0) {
      const vehicleFunctions = new Set<string>();
      assignments.forEach(assignment => {
        if (assignment.fahrzeuge?.some(vehicle => selectedVehicles.includes(vehicle))) {
          vehicleFunctions.add(assignment.funktion);
        }
      });
      availableFunctions = availableFunctions.filter(func => vehicleFunctions.has(func));
    }
    
    // Wenn Zeitraum ausgewählt ist, zeige nur Funktionen mit Einsätzen in diesem Zeitraum
    if (selectedMonth !== 'all' || dateFrom || dateTo) {
      const dateFunctions = new Set<string>();
      assignments.forEach(assignment => {
        const assignmentDate = new Date(assignment.datum);
        let includeAssignment = true;
        
        if (selectedMonth !== 'all') {
          const [year, month] = selectedMonth.split('-');
          includeAssignment = assignmentDate.getFullYear() === parseInt(year) && 
                           assignmentDate.getMonth() === parseInt(month) - 1;
        }
        
        if (dateFrom && includeAssignment) {
          includeAssignment = assignment.datum >= dateFrom;
        }
        
        if (dateTo && includeAssignment) {
          includeAssignment = assignment.datum <= dateTo;
        }
        
        if (includeAssignment) {
          dateFunctions.add(assignment.funktion);
        }
      });
      availableFunctions = availableFunctions.filter(func => dateFunctions.has(func));
    }
    
    return availableFunctions;
  }, [assignments, selectedProjects, selectedVehicles, selectedMonth, dateFrom, dateTo]);

  const filteredVehicles = useMemo(() => {
    let availableVehicles = Array.from(new Set(
      assignments.flatMap(a => a.fahrzeuge || [])
    ));
    
    // Wenn Projekte ausgewählt sind, zeige nur Fahrzeuge aus diesen Projekten
    if (selectedProjects.length > 0) {
      const projectVehicles = new Set<string>();
      assignments.forEach(assignment => {
        if (selectedProjects.includes(assignment.projektName)) {
          (assignment.fahrzeuge || []).forEach(vehicle => projectVehicles.add(vehicle));
        }
      });
      availableVehicles = availableVehicles.filter(vehicle => projectVehicles.has(vehicle));
    }
    
    // Wenn Funktionen ausgewählt sind, zeige nur Fahrzeuge mit diesen Funktionen
    if (selectedFunctions.length > 0) {
      const functionVehicles = new Set<string>();
      assignments.forEach(assignment => {
        if (selectedFunctions.includes(assignment.funktion)) {
          (assignment.fahrzeuge || []).forEach(vehicle => functionVehicles.add(vehicle));
        }
      });
      availableVehicles = availableVehicles.filter(vehicle => functionVehicles.has(vehicle));
    }
    
    // Wenn Zeitraum ausgewählt ist, zeige nur Fahrzeuge mit Einsätzen in diesem Zeitraum
    if (selectedMonth !== 'all' || dateFrom || dateTo) {
      const dateVehicles = new Set<string>();
      assignments.forEach(assignment => {
        const assignmentDate = new Date(assignment.datum);
        let includeAssignment = true;
        
        if (selectedMonth !== 'all') {
          const [year, month] = selectedMonth.split('-');
          includeAssignment = assignmentDate.getFullYear() === parseInt(year) && 
                           assignmentDate.getMonth() === parseInt(month) - 1;
        }
        
        if (dateFrom && includeAssignment) {
          includeAssignment = assignment.datum >= dateFrom;
        }
        
        if (dateTo && includeAssignment) {
          includeAssignment = assignment.datum <= dateTo;
        }
        
        if (includeAssignment) {
          (assignment.fahrzeuge || []).forEach(vehicle => dateVehicles.add(vehicle));
        }
      });
      availableVehicles = availableVehicles.filter(vehicle => dateVehicles.has(vehicle));
    }
    
    return availableVehicles;
  }, [assignments, selectedProjects, selectedFunctions, selectedMonth, dateFrom, dateTo]);

  // Gefilterte Einsätze berechnen
  const filteredAssignments = useMemo(() => {
    let filtered = assignments;

    // Zeitraum-Filter
    if (selectedMonth && selectedMonth !== 'all') {
      const [year, month] = selectedMonth.split('-');
      filtered = filtered.filter(assignment => {
        const assignmentDate = new Date(assignment.datum);
        return assignmentDate.getFullYear() === parseInt(year) && 
               assignmentDate.getMonth() === parseInt(month) - 1;
      });
    }

    if (dateFrom) {
      filtered = filtered.filter(assignment => 
        assignment.datum >= dateFrom
      );
    }

    if (dateTo) {
      filtered = filtered.filter(assignment => 
        assignment.datum <= dateTo
      );
    }

    // Projekt-Filter
    if (selectedProjects.length > 0) {
      filtered = filtered.filter(assignment =>
        selectedProjects.includes(assignment.projektName)
      );
    }

    // Funktion-Filter
    if (selectedFunctions.length > 0) {
      filtered = filtered.filter(assignment =>
        selectedFunctions.includes(assignment.funktion)
      );
    }

    // Fahrzeug-Filter
    if (selectedVehicles.length > 0) {
      filtered = filtered.filter(assignment =>
        assignment.fahrzeuge?.some(vehicle => selectedVehicles.includes(vehicle))
      );
    }

    return filtered;
  }, [assignments, selectedMonth, dateFrom, dateTo, selectedProjects, selectedFunctions, selectedVehicles]);

  // Gefilterte Einsätze an Parent-Komponente übergeben (nur bei Änderungen)
  useEffect(() => {
    // Vergleiche mit dem letzten Wert
    const currentFiltered = JSON.stringify(filteredAssignments);
    const lastFiltered = JSON.stringify(lastFilteredRef.current);
    
    if (currentFiltered !== lastFiltered) {
      lastFilteredRef.current = filteredAssignments;
      onFilterChange(filteredAssignments);
    }
  }, [filteredAssignments, onFilterChange]);

  // Filter zurücksetzen
  const resetFilters = () => {
    setSelectedMonth('all');
    setDateFrom('');
    setDateTo('');
    setSelectedProjects([]);
    setSelectedFunctions([]);
    setSelectedVehicles([]);
  };

  // Aktive Filter zählen
  const activeFiltersCount = [
    selectedMonth,
    dateFrom,
    dateTo,
    selectedProjects.length,
    selectedFunctions.length,
    selectedVehicles.length
  ].filter(Boolean).length;

  return (
    <Card className="border-0 shadow-sm bg-slate-50 dark:bg-slate-800 rounded-xl mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-600 dark:text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Filter {activeFiltersCount > 0 && `(${activeFiltersCount})`}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            {activeFiltersCount > 0 && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={resetFilters}
                className="flex items-center gap-1 rounded-lg border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 dark:text-white text-xs"
              >
                <RefreshCw className="h-3 w-3" />
                Zurücksetzen
              </Button>
            )}
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-1 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs"
            >
              {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {isExpanded ? 'Weniger' : 'Mehr'}
            </Button>
          </div>
        </div>
      </CardHeader>
      
      {isExpanded && (
        <CardContent className="pt-0">
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {/* Zeitraum-Filter */}
            <div className="space-y-3">
              <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">Zeitraum</Label>
              
              <div className="space-y-2">
                <Label className="text-xs text-slate-600 dark:text-slate-400">Monat/Jahr</Label>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="rounded-lg border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white h-8 text-xs">
                    <SelectValue placeholder="Monat wählen" />
                  </SelectTrigger>
                  <SelectContent className="rounded-lg">
                    <SelectItem value="all">Alle Monate</SelectItem>
                    {availableMonths.map(month => {
                      const [year, monthNum] = month.split('-');
                      const monthName = new Date(parseInt(year), parseInt(monthNum) - 1).toLocaleDateString('de-DE', { 
                        month: 'long', 
                        year: 'numeric' 
                      });
                      return (
                        <SelectItem key={month} value={month}>
                          {monthName}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs text-slate-600 dark:text-slate-400">Von</Label>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="rounded-lg border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-slate-600 dark:text-slate-400">Bis</Label>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="rounded-lg border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white h-8 text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Projekt- und Funktion-Filter */}
            <div className="space-y-3">
              <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">Projekt & Funktion</Label>
              
              <div className="space-y-2">
                <MultiSelectDropdown
                  label=""
                  options={filteredProjects}
                  selected={selectedProjects}
                  onChange={setSelectedProjects}
                  placeholder="Projekte wählen"
                />
              </div>

              <div className="space-y-2">
                <MultiSelectDropdown
                  label=""
                  options={filteredFunctions}
                  selected={selectedFunctions}
                  onChange={setSelectedFunctions}
                  placeholder="Funktionen wählen"
                />
              </div>
            </div>

            {/* Fahrzeug-Filter */}
            <div className="space-y-3">
              <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">Fahrzeuge</Label>
              
              <div className="space-y-2">
                <MultiSelectDropdown
                  label=""
                  options={filteredVehicles}
                  selected={selectedVehicles}
                  onChange={setSelectedVehicles}
                  placeholder="Fahrzeuge wählen"
                />
              </div>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
} 