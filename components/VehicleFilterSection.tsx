'use client';
import React from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader } from './ui/card';
import { Filter, RefreshCw } from 'lucide-react';
import type { Vehicle, Project } from '../types';
import MultiSelectDropdown from './ui/MultiSelectDropdown';

interface VehicleFilterSectionProps {
  vehicles: Vehicle[];
  onFilterChange: (filteredVehicles: Vehicle[]) => void;
}

export default function VehicleFilterSection({ vehicles, onFilterChange }: VehicleFilterSectionProps) {
  const [selectedTypes, setSelectedTypes] = React.useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = React.useState<string[]>([]);
  const [searchTerm, setSearchTerm] = React.useState('');

  // Bedingte Logik für Filter-Optionen
  const allAvailableOptions = React.useMemo(() => {
    const allTypes = Array.from(new Set(vehicles.map(v => v.type)));
    const allStatuses = Array.from(new Set(vehicles.map(v => v.manualStatus || 'verfügbar')));
    
    return {
      types: allTypes,
      statuses: allStatuses
    };
  }, [vehicles]);

  // Gefilterte Fahrzeuge
  const filteredVehicles = React.useMemo(() => {
    let filtered = vehicles;

    // Typ-Filter
    if (selectedTypes.length > 0) {
      filtered = filtered.filter(vehicle => selectedTypes.includes(vehicle.type));
    }

    // Status-Filter
    if (selectedStatuses.length > 0) {
      filtered = filtered.filter(vehicle => selectedStatuses.includes(vehicle.manualStatus || 'verfügbar'));
    }

    // Such-Filter
    if (searchTerm) {
      filtered = filtered.filter(vehicle =>
        vehicle.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
        vehicle.licensePlate.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return filtered;
  }, [vehicles, selectedTypes, selectedStatuses, searchTerm]);

  // Gefilterte Optionen für bedingte Logik
  // WICHTIG: Für Multi-Select darf die Optionsliste nicht durch die eigene Auswahl beschnitten werden,
  // sonst kann man keine weiteren Werte hinzufügen. Daher berechnen wir die verfügbaren Werte jeweils
  // nur anhand der anderen Filter.
  const filteredOptions = React.useMemo(() => {
    // Optionen für TYPES: berücksichtige Status- und Suchfilter, aber NICHT selectedTypes
    const vehiclesForTypes = vehicles.filter(v => {
      const matchesStatus = selectedStatuses.length > 0 ? selectedStatuses.includes(v.manualStatus || 'verfügbar') : true;
      const matchesSearch = searchTerm
        ? v.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
          v.licensePlate.toLowerCase().includes(searchTerm.toLowerCase())
        : true;
      return matchesStatus && matchesSearch;
    });
    const filteredTypes = Array.from(new Set(vehiclesForTypes.map(v => v.type)));

    // Optionen für STATUSES: berücksichtige Typ- und Suchfilter, aber NICHT selectedStatuses
    const vehiclesForStatuses = vehicles.filter(v => {
      const matchesType = selectedTypes.length > 0 ? selectedTypes.includes(v.type) : true;
      const matchesSearch = searchTerm
        ? v.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
          v.licensePlate.toLowerCase().includes(searchTerm.toLowerCase())
        : true;
      return matchesType && matchesSearch;
    });
    const filteredStatuses = Array.from(new Set(vehiclesForStatuses.map(v => v.manualStatus || 'verfügbar')));

    return {
      types: filteredTypes,
      statuses: filteredStatuses,
    };
  }, [vehicles, selectedStatuses, selectedTypes, searchTerm]);

  // Gefilterte Fahrzeuge an Parent-Komponente übergeben
  React.useEffect(() => {
    onFilterChange(filteredVehicles);
  }, [filteredVehicles, onFilterChange]);

  // Filter zurücksetzen
  const resetFilters = () => {
    setSelectedTypes([]);
    setSelectedStatuses([]);
    setSearchTerm('');
  };

  // Aktive Filter zählen
  const activeFiltersCount = [
    selectedTypes.length,
    selectedStatuses.length,
    searchTerm ? 1 : 0
  ].filter(Boolean).length;

  return (
    <Card className="border-0 shadow-lg bg-white dark:bg-slate-800 rounded-xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-slate-600 dark:text-slate-400" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Filter {activeFiltersCount > 0 && `(${activeFiltersCount})`}
            </h2>
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
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Suche</Label>
            <Input
              placeholder="Suchen..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="rounded-lg border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
            />
          </div>

          <div className="space-y-2">
            <MultiSelectDropdown
              label="Fahrzeugtyp"
              options={filteredOptions.types}
              selected={selectedTypes}
              onChange={setSelectedTypes}
              placeholder="Typen wählen"
              renderTagsBelow
            />
          </div>

          <div className="space-y-2">
            <MultiSelectDropdown
              label="Status"
              options={filteredOptions.statuses}
              selected={selectedStatuses}
              onChange={setSelectedStatuses}
              placeholder="Status wählen"
              renderTagsBelow
            />
          </div>


        </div>
      </CardContent>
    </Card>
  );
} 