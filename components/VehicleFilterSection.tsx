'use client';
import React from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader } from './ui/card';
import { ChevronDown, ChevronUp, Filter, RefreshCw } from 'lucide-react';
import type { Vehicle } from '../types';
import MultiSelectDropdown from './ui/MultiSelectDropdown';

interface VehicleFilterSectionProps {
  vehicles: Vehicle[];
  onFilterChange: (filteredVehicles: Vehicle[]) => void;
}

export default function VehicleFilterSection({ vehicles, onFilterChange }: VehicleFilterSectionProps) {
  const [selectedTypes, setSelectedTypes] = React.useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = React.useState<string[]>([]);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [isCollapsed, setIsCollapsed] = React.useState(true);

  const allAvailableOptions = React.useMemo(() => {
    const allTypes = Array.from(new Set(vehicles.map(v => v.type)));
    const allStatuses = Array.from(new Set(vehicles.map(v => v.manualStatus || 'verfuegbar')));

    return {
      types: allTypes,
      statuses: allStatuses
    };
  }, [vehicles]);

  const filteredVehicles = React.useMemo(() => {
    let filtered = vehicles;

    if (selectedTypes.length > 0) {
      filtered = filtered.filter(vehicle => selectedTypes.includes(vehicle.type));
    }

    if (selectedStatuses.length > 0) {
      filtered = filtered.filter(vehicle => selectedStatuses.includes(vehicle.manualStatus || 'verfuegbar'));
    }

    if (searchTerm) {
      filtered = filtered.filter(vehicle =>
        vehicle.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
        vehicle.licensePlate.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return filtered;
  }, [vehicles, selectedTypes, selectedStatuses, searchTerm]);

  const filteredOptions = React.useMemo(() => {
    const vehiclesForTypes = vehicles.filter(v => {
      const matchesStatus = selectedStatuses.length > 0 ? selectedStatuses.includes(v.manualStatus || 'verfuegbar') : true;
      const matchesSearch = searchTerm
        ? v.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
          v.licensePlate.toLowerCase().includes(searchTerm.toLowerCase())
        : true;
      return matchesStatus && matchesSearch;
    });
    const filteredTypes = Array.from(new Set(vehiclesForTypes.map(v => v.type)));

    const vehiclesForStatuses = vehicles.filter(v => {
      const matchesType = selectedTypes.length > 0 ? selectedTypes.includes(v.type) : true;
      const matchesSearch = searchTerm
        ? v.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
          v.licensePlate.toLowerCase().includes(searchTerm.toLowerCase())
        : true;
      return matchesType && matchesSearch;
    });
    const filteredStatuses = Array.from(new Set(vehiclesForStatuses.map(v => v.manualStatus || 'verfuegbar')));

    return {
      types: filteredTypes,
      statuses: filteredStatuses,
    };
  }, [vehicles, selectedStatuses, selectedTypes, searchTerm]);

  React.useEffect(() => {
    onFilterChange(filteredVehicles);
  }, [filteredVehicles, onFilterChange]);

  const resetFilters = () => {
    setSelectedTypes([]);
    setSelectedStatuses([]);
    setSearchTerm('');
  };

  const activeFiltersCount = [
    selectedTypes.length,
    selectedStatuses.length,
    searchTerm ? 1 : 0
  ].filter(Boolean).length;

  return (
    <Card className="border-0 shadow-lg bg-white dark:bg-slate-800 rounded-xl">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-slate-600 dark:text-slate-400" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Filter {activeFiltersCount > 0 && `(${activeFiltersCount})`}
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              type="button"
              onClick={() => setIsCollapsed((prev) => !prev)}
              className="flex items-center gap-2 rounded-lg border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 dark:text-white"
              aria-expanded={!isCollapsed}
              aria-controls="vehicle-filter-panel"
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
        <CardContent id="vehicle-filter-panel">
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
                placeholder="Typen waehlen"
                renderTagsBelow
              />
            </div>

            <div className="space-y-2">
              <MultiSelectDropdown
                label="Status"
                options={filteredOptions.statuses}
                selected={selectedStatuses}
                onChange={setSelectedStatuses}
                placeholder="Status waehlen"
                renderTagsBelow
              />
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
