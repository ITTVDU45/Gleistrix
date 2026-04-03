'use client';
import React, { useState, useMemo } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader } from './ui/card';
import { ChevronDown, ChevronUp, Filter, RefreshCw } from 'lucide-react';
import type { Project } from '../types';
import MultiSelectDropdown from './ui/MultiSelectDropdown';

interface ProjectListFilterProps {
  projects: Project[];
  onFilterChange: (filteredProjects: Project[]) => void;
}

export default function ProjectListFilter({ projects, onFilterChange }: ProjectListFilterProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedNames, setSelectedNames] = useState<string[]>([]);
  const [selectedAuftraggeber, setSelectedAuftraggeber] = useState<string[]>([]);
  const [selectedBaustellen, setSelectedBaustellen] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [hoursFrom, setHoursFrom] = useState<string>('');
  const [hoursTo, setHoursTo] = useState<string>('');
  const [isCollapsed, setIsCollapsed] = useState(true);

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

  const filteredNames = useMemo(() => {
    let availableNames = allAvailableOptions.names;

    if (selectedAuftraggeber.length > 0) {
      const auftraggeberNames = new Set<string>();
      projects.forEach(project => {
        if (selectedAuftraggeber.includes(project.auftraggeber)) {
          auftraggeberNames.add(project.name);
        }
      });
      availableNames = availableNames.filter(name => auftraggeberNames.has(name));
    }

    if (selectedBaustellen.length > 0) {
      const baustelleNames = new Set<string>();
      projects.forEach(project => {
        if (selectedBaustellen.includes(project.baustelle)) {
          baustelleNames.add(project.name);
        }
      });
      availableNames = availableNames.filter(name => baustelleNames.has(name));
    }

    if (selectedStatuses.length > 0) {
      const statusNames = new Set<string>();
      projects.forEach(project => {
        if (selectedStatuses.includes(project.status)) {
          statusNames.add(project.name);
        }
      });
      availableNames = availableNames.filter(name => statusNames.has(name));
    }

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

    if (selectedNames.length > 0) {
      const nameAuftraggeber = new Set<string>();
      projects.forEach(project => {
        if (selectedNames.includes(project.name)) {
          nameAuftraggeber.add(project.auftraggeber);
        }
      });
      availableAuftraggeber = availableAuftraggeber.filter(auftraggeber => nameAuftraggeber.has(auftraggeber));
    }

    if (selectedBaustellen.length > 0) {
      const baustelleAuftraggeber = new Set<string>();
      projects.forEach(project => {
        if (selectedBaustellen.includes(project.baustelle)) {
          baustelleAuftraggeber.add(project.auftraggeber);
        }
      });
      availableAuftraggeber = availableAuftraggeber.filter(auftraggeber => baustelleAuftraggeber.has(auftraggeber));
    }

    if (selectedStatuses.length > 0) {
      const statusAuftraggeber = new Set<string>();
      projects.forEach(project => {
        if (selectedStatuses.includes(project.status)) {
          statusAuftraggeber.add(project.auftraggeber);
        }
      });
      availableAuftraggeber = availableAuftraggeber.filter(auftraggeber => statusAuftraggeber.has(auftraggeber));
    }

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

    if (selectedNames.length > 0) {
      const nameBaustellen = new Set<string>();
      projects.forEach(project => {
        if (selectedNames.includes(project.name)) {
          nameBaustellen.add(project.baustelle);
        }
      });
      availableBaustellen = availableBaustellen.filter(baustelle => nameBaustellen.has(baustelle));
    }

    if (selectedAuftraggeber.length > 0) {
      const auftraggeberBaustellen = new Set<string>();
      projects.forEach(project => {
        if (selectedAuftraggeber.includes(project.auftraggeber)) {
          auftraggeberBaustellen.add(project.baustelle);
        }
      });
      availableBaustellen = availableBaustellen.filter(baustelle => auftraggeberBaustellen.has(baustelle));
    }

    if (selectedStatuses.length > 0) {
      const statusBaustellen = new Set<string>();
      projects.forEach(project => {
        if (selectedStatuses.includes(project.status)) {
          statusBaustellen.add(project.baustelle);
        }
      });
      availableBaustellen = availableBaustellen.filter(baustelle => statusBaustellen.has(baustelle));
    }

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

    if (selectedNames.length > 0) {
      const nameStatuses = new Set<string>();
      projects.forEach(project => {
        if (selectedNames.includes(project.name)) {
          nameStatuses.add(project.status);
        }
      });
      availableStatuses = availableStatuses.filter(status => nameStatuses.has(status));
    }

    if (selectedAuftraggeber.length > 0) {
      const auftraggeberStatuses = new Set<string>();
      projects.forEach(project => {
        if (selectedAuftraggeber.includes(project.auftraggeber)) {
          auftraggeberStatuses.add(project.status);
        }
      });
      availableStatuses = availableStatuses.filter(status => auftraggeberStatuses.has(status));
    }

    if (selectedBaustellen.length > 0) {
      const baustelleStatuses = new Set<string>();
      projects.forEach(project => {
        if (selectedBaustellen.includes(project.baustelle)) {
          baustelleStatuses.add(project.status);
        }
      });
      availableStatuses = availableStatuses.filter(status => baustelleStatuses.has(status));
    }

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

  const filteredProjects = useMemo(() => {
    let filtered = projects;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(project =>
        project.name.toLowerCase().includes(term) ||
        project.auftraggeber.toLowerCase().includes(term) ||
        project.baustelle.toLowerCase().includes(term) ||
        project.status.toLowerCase().includes(term)
      );
    }

    if (selectedNames.length > 0) {
      filtered = filtered.filter(project => selectedNames.includes(project.name));
    }

    if (selectedAuftraggeber.length > 0) {
      filtered = filtered.filter(project => selectedAuftraggeber.includes(project.auftraggeber));
    }

    if (selectedBaustellen.length > 0) {
      filtered = filtered.filter(project => selectedBaustellen.includes(project.baustelle));
    }

    if (selectedStatuses.length > 0) {
      filtered = filtered.filter(project => selectedStatuses.includes(project.status));
    }

    if (dateFrom) {
      filtered = filtered.filter(project => project.datumBeginn >= dateFrom);
    }

    if (dateTo) {
      filtered = filtered.filter(project => project.datumEnde <= dateTo);
    }

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

  React.useEffect(() => {
    onFilterChange(filteredProjects);
  }, [filteredProjects, onFilterChange]);

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
    <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/70 ring-1 ring-white">
      <CardHeader className="border-b border-slate-100 pb-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="rounded-xl bg-slate-100 p-2 text-slate-600">
              <Filter className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Filter</h2>
              <p className="text-sm text-slate-500">Grenze Projekte nach Namen, Zeitraum und Stunden ein.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              type="button"
              onClick={() => setIsCollapsed((prev) => !prev)}
              className="flex items-center gap-2 rounded-xl border-slate-200 bg-white hover:bg-slate-50"
              aria-expanded={!isCollapsed}
              aria-controls="project-filter-panel"
            >
              {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
              {isCollapsed ? 'Filter anzeigen' : 'Filter einklappen'}
            </Button>
            <Button
              variant="outline"
              onClick={resetFilters}
              className="flex items-center gap-2 rounded-xl border-slate-200 bg-white hover:bg-slate-50"
            >
              <RefreshCw className="h-4 w-4" />
              Filter zuruecksetzen
            </Button>
          </div>
        </div>
      </CardHeader>
      {!isCollapsed && (
        <CardContent className="p-6" id="project-filter-panel">
          <div className="grid gap-5 grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
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
                placeholder="Projektnamen waehlen"
                renderTagsBelow
              />
            </div>

            <div className="space-y-2">
              <MultiSelectDropdown
                label="Auftraggeber"
                options={filteredAuftraggeber}
                selected={selectedAuftraggeber}
                onChange={setSelectedAuftraggeber}
                placeholder="Auftraggeber waehlen"
                renderTagsBelow
              />
            </div>

            <div className="space-y-2">
              <MultiSelectDropdown
                label="Baustelle"
                options={filteredBaustellen}
                selected={selectedBaustellen}
                onChange={setSelectedBaustellen}
                placeholder="Baustellen waehlen"
                renderTagsBelow
              />
            </div>

            <div className="space-y-2">
              <MultiSelectDropdown
                label="Status"
                options={filteredStatuses}
                selected={selectedStatuses}
                onChange={setSelectedStatuses}
                placeholder="Status waehlen"
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
      )}
    </Card>
  );
}
