'use client';
import React, { useState, useMemo } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader } from './ui/card';
import { Filter, RefreshCw } from 'lucide-react';
import type { Project } from '../types';
import MultiSelectDropdown from './ui/MultiSelectDropdown';

interface ProjectListFilterProps {
  projects: Project[];
  onFilterChange: (filteredProjects: Project[]) => void;
}

export default function ProjectListFilter({ projects, onFilterChange }: ProjectListFilterProps) {
  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedNames, setSelectedNames] = useState<string[]>([]);
  const [selectedAuftraggeber, setSelectedAuftraggeber] = useState<string[]>([]);
  const [selectedBaustellen, setSelectedBaustellen] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [hoursFrom, setHoursFrom] = useState<string>('');
  const [hoursTo, setHoursTo] = useState<string>('');

  // Alle verfügbaren Optionen
  const allAvailableOptions = useMemo(() => {
    const allNames = Array.from(new Set(projects.map(p => p.name)));
    const allAuftraggeber = Array.from(new Set(projects.map(p => p.auftraggeber)));
    const allBaustellen = Array.from(new Set(projects.map(p => p.baustelle)));
    const allStatuses = Array.from(new Set(projects.map(p => p.status)));

    return {
      names: allNames,
      auftraggeber: allAuftraggeber,
      baustellen: allBaustellen,
      statuses: allStatuses
    };
  }, [projects]);

  // Bedingte Logik: Gefilterte Optionen basierend auf anderen Filtern
  const filteredNames = useMemo(() => {
    let availableNames = allAvailableOptions.names;
    
    // Wenn Auftraggeber ausgewählt sind, zeige nur Namen mit diesen Auftraggebern
    if (selectedAuftraggeber.length > 0) {
      const auftraggeberNames = new Set<string>();
      projects.forEach(project => {
        if (selectedAuftraggeber.includes(project.auftraggeber)) {
          auftraggeberNames.add(project.name);
        }
      });
      availableNames = availableNames.filter(name => auftraggeberNames.has(name));
    }
    
    // Wenn Baustellen ausgewählt sind, zeige nur Namen mit diesen Baustellen
    if (selectedBaustellen.length > 0) {
      const baustelleNames = new Set<string>();
      projects.forEach(project => {
        if (selectedBaustellen.includes(project.baustelle)) {
          baustelleNames.add(project.name);
        }
      });
      availableNames = availableNames.filter(name => baustelleNames.has(name));
    }
    
    // Wenn Status ausgewählt sind, zeige nur Namen mit diesen Status
    if (selectedStatuses.length > 0) {
      const statusNames = new Set<string>();
      projects.forEach(project => {
        if (selectedStatuses.includes(project.status)) {
          statusNames.add(project.name);
        }
      });
      availableNames = availableNames.filter(name => statusNames.has(name));
    }
    
    // Wenn Datum ausgewählt ist, zeige nur Namen mit Projekten in diesem Zeitraum
    if (dateFrom || dateTo) {
      const dateNames = new Set<string>();
      projects.forEach(project => {
        let includeProject = true;
        
        if (dateFrom) {
          includeProject = project.datumBeginn >= dateFrom;
        }
        
        if (dateTo && includeProject) {
          includeProject = project.datumEnde <= dateTo;
        }
        
        if (includeProject) {
          dateNames.add(project.name);
        }
      });
      availableNames = availableNames.filter(name => dateNames.has(name));
    }
    
    // Wenn Stunden-Filter gesetzt sind, zeige nur Namen mit Projekten in diesem Stundenbereich
    if (hoursFrom || hoursTo) {
      const hoursNames = new Set<string>();
      projects.forEach(project => {
        const totalHours = Object.values(project.mitarbeiterZeiten || {}).reduce((sum: number, entries: any[]) => {
          return sum + entries.reduce((entrySum: number, entry: any) => entrySum + entry.stunden, 0);
        }, 0);
        
        let includeProject = true;
        if (hoursFrom && totalHours < parseFloat(hoursFrom)) includeProject = false;
        if (hoursTo && totalHours > parseFloat(hoursTo)) includeProject = false;
        
        if (includeProject) {
          hoursNames.add(project.name);
        }
      });
      availableNames = availableNames.filter(name => hoursNames.has(name));
    }
    
    return availableNames;
  }, [projects, allAvailableOptions.names, selectedAuftraggeber, selectedBaustellen, selectedStatuses, dateFrom, dateTo, hoursFrom, hoursTo]);

  const filteredAuftraggeber = useMemo(() => {
    let availableAuftraggeber = allAvailableOptions.auftraggeber;
    
    // Wenn Namen ausgewählt sind, zeige nur Auftraggeber mit diesen Namen
    if (selectedNames.length > 0) {
      const nameAuftraggeber = new Set<string>();
      projects.forEach(project => {
        if (selectedNames.includes(project.name)) {
          nameAuftraggeber.add(project.auftraggeber);
        }
      });
      availableAuftraggeber = availableAuftraggeber.filter(auftraggeber => nameAuftraggeber.has(auftraggeber));
    }
    
    // Wenn Baustellen ausgewählt sind, zeige nur Auftraggeber mit diesen Baustellen
    if (selectedBaustellen.length > 0) {
      const baustelleAuftraggeber = new Set<string>();
      projects.forEach(project => {
        if (selectedBaustellen.includes(project.baustelle)) {
          baustelleAuftraggeber.add(project.auftraggeber);
        }
      });
      availableAuftraggeber = availableAuftraggeber.filter(auftraggeber => baustelleAuftraggeber.has(auftraggeber));
    }
    
    // Wenn Status ausgewählt sind, zeige nur Auftraggeber mit diesen Status
    if (selectedStatuses.length > 0) {
      const statusAuftraggeber = new Set<string>();
      projects.forEach(project => {
        if (selectedStatuses.includes(project.status)) {
          statusAuftraggeber.add(project.auftraggeber);
        }
      });
      availableAuftraggeber = availableAuftraggeber.filter(auftraggeber => statusAuftraggeber.has(auftraggeber));
    }
    
    // Wenn Datum ausgewählt ist, zeige nur Auftraggeber mit Projekten in diesem Zeitraum
    if (dateFrom || dateTo) {
      const dateAuftraggeber = new Set<string>();
      projects.forEach(project => {
        let includeProject = true;
        
        if (dateFrom) {
          includeProject = project.datumBeginn >= dateFrom;
        }
        
        if (dateTo && includeProject) {
          includeProject = project.datumEnde <= dateTo;
        }
        
        if (includeProject) {
          dateAuftraggeber.add(project.auftraggeber);
        }
      });
      availableAuftraggeber = availableAuftraggeber.filter(auftraggeber => dateAuftraggeber.has(auftraggeber));
    }
    
    // Wenn Stunden-Filter gesetzt sind, zeige nur Auftraggeber mit Projekten in diesem Stundenbereich
    if (hoursFrom || hoursTo) {
      const hoursAuftraggeber = new Set<string>();
      projects.forEach(project => {
        const totalHours = Object.values(project.mitarbeiterZeiten || {}).reduce((sum: number, entries: any[]) => {
          return sum + entries.reduce((entrySum: number, entry: any) => entrySum + entry.stunden, 0);
        }, 0);
        
        let includeProject = true;
        if (hoursFrom && totalHours < parseFloat(hoursFrom)) includeProject = false;
        if (hoursTo && totalHours > parseFloat(hoursTo)) includeProject = false;
        
        if (includeProject) {
          hoursAuftraggeber.add(project.auftraggeber);
        }
      });
      availableAuftraggeber = availableAuftraggeber.filter(auftraggeber => hoursAuftraggeber.has(auftraggeber));
    }
    
    return availableAuftraggeber;
  }, [projects, allAvailableOptions.auftraggeber, selectedNames, selectedBaustellen, selectedStatuses, dateFrom, dateTo, hoursFrom, hoursTo]);

  const filteredBaustellen = useMemo(() => {
    let availableBaustellen = allAvailableOptions.baustellen;
    
    // Wenn Namen ausgewählt sind, zeige nur Baustellen mit diesen Namen
    if (selectedNames.length > 0) {
      const nameBaustellen = new Set<string>();
      projects.forEach(project => {
        if (selectedNames.includes(project.name)) {
          nameBaustellen.add(project.baustelle);
        }
      });
      availableBaustellen = availableBaustellen.filter(baustelle => nameBaustellen.has(baustelle));
    }
    
    // Wenn Auftraggeber ausgewählt sind, zeige nur Baustellen mit diesen Auftraggebern
    if (selectedAuftraggeber.length > 0) {
      const auftraggeberBaustellen = new Set<string>();
      projects.forEach(project => {
        if (selectedAuftraggeber.includes(project.auftraggeber)) {
          auftraggeberBaustellen.add(project.baustelle);
        }
      });
      availableBaustellen = availableBaustellen.filter(baustelle => auftraggeberBaustellen.has(baustelle));
    }
    
    // Wenn Status ausgewählt sind, zeige nur Baustellen mit diesen Status
    if (selectedStatuses.length > 0) {
      const statusBaustellen = new Set<string>();
      projects.forEach(project => {
        if (selectedStatuses.includes(project.status)) {
          statusBaustellen.add(project.baustelle);
        }
      });
      availableBaustellen = availableBaustellen.filter(baustelle => statusBaustellen.has(baustelle));
    }
    
    // Wenn Datum ausgewählt ist, zeige nur Baustellen mit Projekten in diesem Zeitraum
    if (dateFrom || dateTo) {
      const dateBaustellen = new Set<string>();
      projects.forEach(project => {
        let includeProject = true;
        
        if (dateFrom) {
          includeProject = project.datumBeginn >= dateFrom;
        }
        
        if (dateTo && includeProject) {
          includeProject = project.datumEnde <= dateTo;
        }
        
        if (includeProject) {
          dateBaustellen.add(project.baustelle);
        }
      });
      availableBaustellen = availableBaustellen.filter(baustelle => dateBaustellen.has(baustelle));
    }
    
    // Wenn Stunden-Filter gesetzt sind, zeige nur Baustellen mit Projekten in diesem Stundenbereich
    if (hoursFrom || hoursTo) {
      const hoursBaustellen = new Set<string>();
      projects.forEach(project => {
        const totalHours = Object.values(project.mitarbeiterZeiten || {}).reduce((sum: number, entries: any[]) => {
          return sum + entries.reduce((entrySum: number, entry: any) => entrySum + entry.stunden, 0);
        }, 0);
        
        let includeProject = true;
        if (hoursFrom && totalHours < parseFloat(hoursFrom)) includeProject = false;
        if (hoursTo && totalHours > parseFloat(hoursTo)) includeProject = false;
        
        if (includeProject) {
          hoursBaustellen.add(project.baustelle);
        }
      });
      availableBaustellen = availableBaustellen.filter(baustelle => hoursBaustellen.has(baustelle));
    }
    
    return availableBaustellen;
  }, [projects, allAvailableOptions.baustellen, selectedNames, selectedAuftraggeber, selectedStatuses, dateFrom, dateTo, hoursFrom, hoursTo]);

  const filteredStatuses = useMemo(() => {
    let availableStatuses = allAvailableOptions.statuses;
    
    // Wenn Namen ausgewählt sind, zeige nur Status mit diesen Namen
    if (selectedNames.length > 0) {
      const nameStatuses = new Set<string>();
      projects.forEach(project => {
        if (selectedNames.includes(project.name)) {
          nameStatuses.add(project.status);
        }
      });
      availableStatuses = availableStatuses.filter(status => nameStatuses.has(status));
    }
    
    // Wenn Auftraggeber ausgewählt sind, zeige nur Status mit diesen Auftraggebern
    if (selectedAuftraggeber.length > 0) {
      const auftraggeberStatuses = new Set<string>();
      projects.forEach(project => {
        if (selectedAuftraggeber.includes(project.auftraggeber)) {
          auftraggeberStatuses.add(project.status);
        }
      });
      availableStatuses = availableStatuses.filter(status => auftraggeberStatuses.has(status));
    }
    
    // Wenn Baustellen ausgewählt sind, zeige nur Status mit diesen Baustellen
    if (selectedBaustellen.length > 0) {
      const baustelleStatuses = new Set<string>();
      projects.forEach(project => {
        if (selectedBaustellen.includes(project.baustelle)) {
          baustelleStatuses.add(project.status);
        }
      });
      availableStatuses = availableStatuses.filter(status => baustelleStatuses.has(status));
    }
    
    // Wenn Datum ausgewählt ist, zeige nur Status mit Projekten in diesem Zeitraum
    if (dateFrom || dateTo) {
      const dateStatuses = new Set<string>();
      projects.forEach(project => {
        let includeProject = true;
        
        if (dateFrom) {
          includeProject = project.datumBeginn >= dateFrom;
        }
        
        if (dateTo && includeProject) {
          includeProject = project.datumEnde <= dateTo;
        }
        
        if (includeProject) {
          dateStatuses.add(project.status);
        }
      });
      availableStatuses = availableStatuses.filter(status => dateStatuses.has(status));
    }
    
    // Wenn Stunden-Filter gesetzt sind, zeige nur Status mit Projekten in diesem Stundenbereich
    if (hoursFrom || hoursTo) {
      const hoursStatuses = new Set<string>();
      projects.forEach(project => {
        const totalHours = Object.values(project.mitarbeiterZeiten || {}).reduce((sum: number, entries: any[]) => {
          return sum + entries.reduce((entrySum: number, entry: any) => entrySum + entry.stunden, 0);
        }, 0);
        
        let includeProject = true;
        if (hoursFrom && totalHours < parseFloat(hoursFrom)) includeProject = false;
        if (hoursTo && totalHours > parseFloat(hoursTo)) includeProject = false;
        
        if (includeProject) {
          hoursStatuses.add(project.status);
        }
      });
      availableStatuses = availableStatuses.filter(status => hoursStatuses.has(status));
    }
    
    return availableStatuses;
  }, [projects, allAvailableOptions.statuses, selectedNames, selectedAuftraggeber, selectedBaustellen, dateFrom, dateTo, hoursFrom, hoursTo]);

  // Gefilterte Projekte berechnen
  const filteredProjects = useMemo(() => {
    let filtered = projects;

    // Suchbegriff-Filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(project =>
        project.name.toLowerCase().includes(term) ||
        project.auftraggeber.toLowerCase().includes(term) ||
        project.baustelle.toLowerCase().includes(term) ||
        project.status.toLowerCase().includes(term)
      );
    }

    // Namen-Filter
    if (selectedNames.length > 0) {
      filtered = filtered.filter(project =>
        selectedNames.includes(project.name)
      );
    }

    // Auftraggeber-Filter
    if (selectedAuftraggeber.length > 0) {
      filtered = filtered.filter(project =>
        selectedAuftraggeber.includes(project.auftraggeber)
      );
    }

    // Baustelle-Filter
    if (selectedBaustellen.length > 0) {
      filtered = filtered.filter(project =>
        selectedBaustellen.includes(project.baustelle)
      );
    }

    // Status-Filter
    if (selectedStatuses.length > 0) {
      filtered = filtered.filter(project =>
        selectedStatuses.includes(project.status)
      );
    }

    // Datum-Filter
    if (dateFrom) {
      filtered = filtered.filter(project => project.datumBeginn >= dateFrom);
    }

    if (dateTo) {
      filtered = filtered.filter(project => project.datumEnde <= dateTo);
    }

    // Stunden-Filter
    if (hoursFrom || hoursTo) {
      filtered = filtered.filter(project => {
        const totalHours = Object.values(project.mitarbeiterZeiten || {}).reduce((sum: number, entries: any[]) => {
          return sum + entries.reduce((entrySum: number, entry: any) => entrySum + entry.stunden, 0);
        }, 0);

        if (hoursFrom && totalHours < parseFloat(hoursFrom)) return false;
        if (hoursTo && totalHours > parseFloat(hoursTo)) return false;
        return true;
      });
    }

    return filtered;
  }, [projects, searchTerm, selectedNames, selectedAuftraggeber, selectedBaustellen, selectedStatuses, dateFrom, dateTo, hoursFrom, hoursTo]);

  // Gefilterte Projekte an Parent-Komponente übergeben
  React.useEffect(() => {
    onFilterChange(filteredProjects);
  }, [filteredProjects, onFilterChange]);

  // Filter zurücksetzen
  const resetFilters = () => {
    setSearchTerm('');
    setSelectedNames([]);
    setSelectedAuftraggeber([]);
    setSelectedBaustellen([]);
    setSelectedStatuses([]);
    setDateFrom('');
    setDateTo('');
    setHoursFrom('');
    setHoursTo('');
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
              label="Projektname"
              options={filteredNames}
              selected={selectedNames}
              onChange={setSelectedNames}
              placeholder="Projektnamen wählen"
              renderTagsBelow
            />
          </div>

          <div className="space-y-2">
            <MultiSelectDropdown
              label="Auftraggeber"
              options={filteredAuftraggeber}
              selected={selectedAuftraggeber}
              onChange={setSelectedAuftraggeber}
              placeholder="Auftraggeber wählen"
              renderTagsBelow
            />
          </div>

          <div className="space-y-2">
            <MultiSelectDropdown
              label="Baustelle"
              options={filteredBaustellen}
              selected={selectedBaustellen}
              onChange={setSelectedBaustellen}
              placeholder="Baustellen wählen"
              renderTagsBelow
            />
          </div>

          <div className="space-y-2">
            <MultiSelectDropdown
              label="Status"
              options={filteredStatuses}
              selected={selectedStatuses}
              onChange={setSelectedStatuses}
              placeholder="Status wählen"
              renderTagsBelow
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Datum von</Label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="rounded-lg border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Datum bis</Label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="rounded-lg border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Stunden von</Label>
            <Input
              type="number"
              placeholder="0"
              value={hoursFrom}
              onChange={(e) => setHoursFrom(e.target.value)}
              className="rounded-lg border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Stunden bis</Label>
            <Input
              type="number"
              placeholder="100"
              value={hoursTo}
              onChange={(e) => setHoursTo(e.target.value)}
              className="rounded-lg border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 