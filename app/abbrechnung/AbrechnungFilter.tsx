"use client"
import React, { useState, useMemo, useEffect, useRef } from 'react'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Card, CardContent, CardHeader } from '../../components/ui/card'
import { Filter, RefreshCw } from 'lucide-react'
import MultiSelectDropdown from '../../components/ui/MultiSelectDropdown'

type Props = { projects: any[]; onFilterChange: (filtered: any[]) => void }

export default function AbrechnungFilter({ projects, onFilterChange }: Props) {
  // Filter States
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedNames, setSelectedNames] = useState<string[]>([])
  const [selectedAuftraggeber, setSelectedAuftraggeber] = useState<string[]>([])
  const [selectedBaustellen, setSelectedBaustellen] = useState<string[]>([])
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([])
  const [dateFrom, setDateFrom] = useState<string>('')
  const [dateTo, setDateTo] = useState<string>('')
  const [hoursFrom, setHoursFrom] = useState<string>('')
  const [hoursTo, setHoursTo] = useState<string>('')

  // Alle verfügbaren Optionen
  const allAvailableOptions = useMemo(() => {
    const allNames = Array.from(new Set(projects.map(p => p.name).filter(Boolean)))
    const allAuftraggeber = Array.from(new Set(projects.map(p => p.auftraggeber).filter(Boolean)))
    const allBaustellen = Array.from(new Set(projects.map(p => p.baustelle).filter(Boolean)))
    const allStatuses = Array.from(new Set(projects.map(p => p.status).filter(Boolean)))

    return {
      names: allNames,
      auftraggeber: allAuftraggeber,
      baustellen: allBaustellen,
      statuses: allStatuses,
    }
  }, [projects])

  // Dynamische option filtering (kopiert von ProjectListFilter)
  const filteredNames = useMemo(() => {
    let availableNames = allAvailableOptions.names

    if (selectedAuftraggeber.length > 0) {
      const auftraggeberNames = new Set<string>()
      projects.forEach(project => {
        if (selectedAuftraggeber.includes(project.auftraggeber)) auftraggeberNames.add(project.name)
      })
      availableNames = availableNames.filter(name => auftraggeberNames.has(name))
    }

    if (selectedBaustellen.length > 0) {
      const baustelleNames = new Set<string>()
      projects.forEach(project => {
        if (selectedBaustellen.includes(project.baustelle)) baustelleNames.add(project.name)
      })
      availableNames = availableNames.filter(name => baustelleNames.has(name))
    }

    if (selectedStatuses.length > 0) {
      const statusNames = new Set<string>()
      projects.forEach(project => {
        if (selectedStatuses.includes(project.status)) statusNames.add(project.name)
      })
      availableNames = availableNames.filter(name => statusNames.has(name))
    }

    if (dateFrom || dateTo) {
      const dateNames = new Set<string>()
      projects.forEach(project => {
        let includeProject = true
        if (dateFrom) includeProject = project.datumBeginn >= dateFrom
        if (dateTo && includeProject) includeProject = project.datumEnde <= dateTo
        if (includeProject) dateNames.add(project.name)
      })
      availableNames = availableNames.filter(name => dateNames.has(name))
    }

    if (hoursFrom || hoursTo) {
      const hoursNames = new Set<string>()
      projects.forEach(project => {
        const totalHours = Object.values(project.mitarbeiterZeiten || {}).reduce((sum: number, entries: any[]) => {
          return sum + entries.reduce((entrySum: number, entry: any) => entrySum + (entry.stunden || 0), 0)
        }, 0)
        let includeProject = true
        if (hoursFrom && totalHours < parseFloat(hoursFrom)) includeProject = false
        if (hoursTo && totalHours > parseFloat(hoursTo)) includeProject = false
        if (includeProject) hoursNames.add(project.name)
      })
      availableNames = availableNames.filter(name => hoursNames.has(name))
    }

    return availableNames
  }, [projects, allAvailableOptions.names, selectedAuftraggeber, selectedBaustellen, selectedStatuses, dateFrom, dateTo, hoursFrom, hoursTo])

  const filteredAuftraggeber = useMemo(() => {
    let availableAuftraggeber = allAvailableOptions.auftraggeber
    if (selectedNames.length > 0) {
      const nameAuftraggeber = new Set<string>()
      projects.forEach(project => { if (selectedNames.includes(project.name)) nameAuftraggeber.add(project.auftraggeber) })
      availableAuftraggeber = availableAuftraggeber.filter(a => nameAuftraggeber.has(a))
    }
    if (selectedBaustellen.length > 0) {
      const baustelleAuftraggeber = new Set<string>()
      projects.forEach(project => { if (selectedBaustellen.includes(project.baustelle)) baustelleAuftraggeber.add(project.auftraggeber) })
      availableAuftraggeber = availableAuftraggeber.filter(a => baustelleAuftraggeber.has(a))
    }
    if (selectedStatuses.length > 0) {
      const statusAuftraggeber = new Set<string>()
      projects.forEach(project => { if (selectedStatuses.includes(project.status)) statusAuftraggeber.add(project.auftraggeber) })
      availableAuftraggeber = availableAuftraggeber.filter(a => statusAuftraggeber.has(a))
    }
    if (dateFrom || dateTo) {
      const dateAuftraggeber = new Set<string>()
      projects.forEach(project => {
        let includeProject = true
        if (dateFrom) includeProject = project.datumBeginn >= dateFrom
        if (dateTo && includeProject) includeProject = project.datumEnde <= dateTo
        if (includeProject) dateAuftraggeber.add(project.auftraggeber)
      })
      availableAuftraggeber = availableAuftraggeber.filter(a => dateAuftraggeber.has(a))
    }
    if (hoursFrom || hoursTo) {
      const hoursAuftraggeber = new Set<string>()
      projects.forEach(project => {
        const totalHours = Object.values(project.mitarbeiterZeiten || {}).reduce((sum: number, entries: any[]) => {
          return sum + entries.reduce((entrySum: number, entry: any) => entrySum + (entry.stunden || 0), 0)
        }, 0)
        let includeProject = true
        if (hoursFrom && totalHours < parseFloat(hoursFrom)) includeProject = false
        if (hoursTo && totalHours > parseFloat(hoursTo)) includeProject = false
        if (includeProject) hoursAuftraggeber.add(project.auftraggeber)
      })
      availableAuftraggeber = availableAuftraggeber.filter(a => hoursAuftraggeber.has(a))
    }
    return availableAuftraggeber
  }, [projects, allAvailableOptions.auftraggeber, selectedNames, selectedBaustellen, selectedStatuses, dateFrom, dateTo, hoursFrom, hoursTo])

  const filteredBaustellen = useMemo(() => {
    let availableBaustellen = allAvailableOptions.baustellen
    if (selectedNames.length > 0) {
      const nameBaustellen = new Set<string>()
      projects.forEach(project => { if (selectedNames.includes(project.name)) nameBaustellen.add(project.baustelle) })
      availableBaustellen = availableBaustellen.filter(b => nameBaustellen.has(b))
    }
    if (selectedAuftraggeber.length > 0) {
      const auftraggeberBaustellen = new Set<string>()
      projects.forEach(project => { if (selectedAuftraggeber.includes(project.auftraggeber)) auftraggeberBaustellen.add(project.baustelle) })
      availableBaustellen = availableBaustellen.filter(b => auftraggeberBaustellen.has(b))
    }
    if (selectedStatuses.length > 0) {
      const statusBaustellen = new Set<string>()
      projects.forEach(project => { if (selectedStatuses.includes(project.status)) statusBaustellen.add(project.baustelle) })
      availableBaustellen = availableBaustellen.filter(b => statusBaustellen.has(b))
    }
    if (dateFrom || dateTo) {
      const dateBaustellen = new Set<string>()
      projects.forEach(project => {
        let includeProject = true
        if (dateFrom) includeProject = project.datumBeginn >= dateFrom
        if (dateTo && includeProject) includeProject = project.datumEnde <= dateTo
        if (includeProject) dateBaustellen.add(project.baustelle)
      })
      availableBaustellen = availableBaustellen.filter(b => dateBaustellen.has(b))
    }
    if (hoursFrom || hoursTo) {
      const hoursBaustellen = new Set<string>()
      projects.forEach(project => {
        const totalHours = Object.values(project.mitarbeiterZeiten || {}).reduce((sum: number, entries: any[]) => {
          return sum + entries.reduce((entrySum: number, entry: any) => entrySum + (entry.stunden || 0), 0)
        }, 0)
        let includeProject = true
        if (hoursFrom && totalHours < parseFloat(hoursFrom)) includeProject = false
        if (hoursTo && totalHours > parseFloat(hoursTo)) includeProject = false
        if (includeProject) hoursBaustellen.add(project.baustelle)
      })
      availableBaustellen = availableBaustellen.filter(b => hoursBaustellen.has(b))
    }
    return availableBaustellen
  }, [projects, allAvailableOptions.baustellen, selectedNames, selectedAuftraggeber, selectedStatuses, dateFrom, dateTo, hoursFrom, hoursTo])

  const filteredStatuses = useMemo(() => {
    let availableStatuses = allAvailableOptions.statuses
    if (selectedNames.length > 0) {
      const nameStatuses = new Set<string>()
      projects.forEach(project => { if (selectedNames.includes(project.name)) nameStatuses.add(project.status) })
      availableStatuses = availableStatuses.filter(s => nameStatuses.has(s))
    }
    if (selectedAuftraggeber.length > 0) {
      const auftraggeberStatuses = new Set<string>()
      projects.forEach(project => { if (selectedAuftraggeber.includes(project.auftraggeber)) auftraggeberStatuses.add(project.status) })
      availableStatuses = availableStatuses.filter(s => auftraggeberStatuses.has(s))
    }
    if (selectedBaustellen.length > 0) {
      const baustelleStatuses = new Set<string>()
      projects.forEach(project => { if (selectedBaustellen.includes(project.baustelle)) baustelleStatuses.add(project.status) })
      availableStatuses = availableStatuses.filter(s => baustelleStatuses.has(s))
    }
    if (dateFrom || dateTo) {
      const dateStatuses = new Set<string>()
      projects.forEach(project => {
        let includeProject = true
        if (dateFrom) includeProject = project.datumBeginn >= dateFrom
        if (dateTo && includeProject) includeProject = project.datumEnde <= dateTo
        if (includeProject) dateStatuses.add(project.status)
      })
      availableStatuses = availableStatuses.filter(s => dateStatuses.has(s))
    }
    if (hoursFrom || hoursTo) {
      const hoursStatuses = new Set<string>()
      projects.forEach(project => {
        const totalHours = Object.values(project.mitarbeiterZeiten || {}).reduce((sum: number, entries: any[]) => {
          return sum + entries.reduce((entrySum: number, entry: any) => entrySum + (entry.stunden || 0), 0)
        }, 0)
        let includeProject = true
        if (hoursFrom && totalHours < parseFloat(hoursFrom)) includeProject = false
        if (hoursTo && totalHours > parseFloat(hoursTo)) includeProject = false
        if (includeProject) hoursStatuses.add(project.status)
      })
      availableStatuses = availableStatuses.filter(s => hoursStatuses.has(s))
    }
    return availableStatuses
  }, [projects, allAvailableOptions.statuses, selectedNames, selectedAuftraggeber, selectedBaustellen, dateFrom, dateTo, hoursFrom, hoursTo])

  // Gefilterte Projekte berechnen
  const filteredProjects = useMemo(() => {
    let filtered = projects

    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(project =>
        (project.name || '').toLowerCase().includes(term) ||
        (project.auftraggeber || '').toLowerCase().includes(term) ||
        (project.baustelle || '').toLowerCase().includes(term) ||
        (project.status || '').toLowerCase().includes(term)
      )
    }

    if (selectedNames.length > 0) filtered = filtered.filter(project => selectedNames.includes(project.name))
    if (selectedAuftraggeber.length > 0) filtered = filtered.filter(project => selectedAuftraggeber.includes(project.auftraggeber))
    if (selectedBaustellen.length > 0) filtered = filtered.filter(project => selectedBaustellen.includes(project.baustelle))
    if (selectedStatuses.length > 0) filtered = filtered.filter(project => selectedStatuses.includes(project.status))

    if (dateFrom) filtered = filtered.filter(project => project.datumBeginn >= dateFrom)
    if (dateTo) filtered = filtered.filter(project => project.datumEnde <= dateTo)

    if (hoursFrom || hoursTo) {
      filtered = filtered.filter(project => {
        const totalHours = Object.values(project.mitarbeiterZeiten || {}).reduce((sum: number, entries: any[]) => {
          return sum + entries.reduce((entrySum: number, entry: any) => entrySum + (entry.stunden || 0), 0)
        }, 0)
        if (hoursFrom && totalHours < parseFloat(hoursFrom)) return false
        if (hoursTo && totalHours > parseFloat(hoursTo)) return false
        return true
      })
    }

    return filtered
  }, [projects, searchTerm, selectedNames, selectedAuftraggeber, selectedBaustellen, selectedStatuses, dateFrom, dateTo, hoursFrom, hoursTo])

  // Use ref to avoid infinite loops when parent passes a new callback identity
  const onFilterChangeRef = useRef(onFilterChange)
  useEffect(() => { onFilterChangeRef.current = onFilterChange }, [onFilterChange])
  useEffect(() => { onFilterChangeRef.current(filteredProjects) }, [filteredProjects])

  // Reset
  const resetFilters = () => {
    setSearchTerm('')
    setSelectedNames([])
    setSelectedAuftraggeber([])
    setSelectedBaustellen([])
    setSelectedStatuses([])
    setDateFrom('')
    setDateTo('')
    setHoursFrom('')
    setHoursTo('')
  }

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
  )
}


