"use client"

import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Plus, Edit, Trash2, Calendar, Loader2, ChevronLeft, ChevronRight } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { de } from 'date-fns/locale'
import { HolidaysApi, type Holiday } from '@/lib/api/holidays'

// Deutsche Bundesländer
const BUNDESLAENDER = [
  { value: 'ALL', label: 'Bundesweit' },
  { value: 'BW', label: 'Baden-Württemberg' },
  { value: 'BY', label: 'Bayern' },
  { value: 'BE', label: 'Berlin' },
  { value: 'BB', label: 'Brandenburg' },
  { value: 'HB', label: 'Bremen' },
  { value: 'HH', label: 'Hamburg' },
  { value: 'HE', label: 'Hessen' },
  { value: 'MV', label: 'Mecklenburg-Vorpommern' },
  { value: 'NI', label: 'Niedersachsen' },
  { value: 'NW', label: 'Nordrhein-Westfalen' },
  { value: 'RP', label: 'Rheinland-Pfalz' },
  { value: 'SL', label: 'Saarland' },
  { value: 'SN', label: 'Sachsen' },
  { value: 'ST', label: 'Sachsen-Anhalt' },
  { value: 'SH', label: 'Schleswig-Holstein' },
  { value: 'TH', label: 'Thüringen' }
]

export default function FeiertagePage() {
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Filter
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString())
  const [filterBundesland, setFilterBundesland] = useState<string>('ALL')
  
  // Dialog State
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null)
  const [formData, setFormData] = useState({
    date: '',
    name: '',
    bundesland: 'ALL'
  })
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)

  // Feiertage laden
  const loadHolidays = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await HolidaysApi.list({
        year: selectedYear,
        bundesland: filterBundesland !== 'ALL' ? filterBundesland : undefined
      })
      if (response.success) {
        setHolidays(response.holidays)
      } else {
        setError(response.error || 'Fehler beim Laden der Feiertage')
      }
    } catch (err) {
      setError('Fehler beim Laden der Feiertage')
    } finally {
      setIsLoading(false)
    }
  }, [selectedYear, filterBundesland])

  useEffect(() => {
    loadHolidays()
  }, [loadHolidays])

  // Dialog öffnen (Neu oder Bearbeiten)
  const openDialog = (holiday?: Holiday) => {
    if (holiday) {
      setEditingHoliday(holiday)
      setFormData({
        date: holiday.date,
        name: holiday.name,
        bundesland: holiday.bundesland
      })
    } else {
      setEditingHoliday(null)
      setFormData({
        date: `${selectedYear}-01-01`,
        name: '',
        bundesland: 'ALL'
      })
    }
    setDialogOpen(true)
  }

  // Feiertag speichern
  const handleSave = async () => {
    if (!formData.date || !formData.name) return

    setIsSaving(true)
    try {
      let response
      if (editingHoliday) {
        response = await HolidaysApi.update(editingHoliday.id, formData)
      } else {
        response = await HolidaysApi.create(formData)
      }

      if (response.success) {
        setDialogOpen(false)
        loadHolidays()
      } else {
        setError(response.error || 'Fehler beim Speichern')
      }
    } catch (err) {
      setError('Fehler beim Speichern')
    } finally {
      setIsSaving(false)
    }
  }

  // Feiertag löschen
  const handleDelete = async (id: string) => {
    if (!confirm('Möchten Sie diesen Feiertag wirklich löschen?')) return

    setIsDeleting(id)
    try {
      const response = await HolidaysApi.delete(id)
      if (response.success) {
        loadHolidays()
      } else {
        setError(response.error || 'Fehler beim Löschen')
      }
    } catch (err) {
      setError('Fehler beim Löschen')
    } finally {
      setIsDeleting(null)
    }
  }

  // Jahr-Navigation
  const years = Array.from({ length: 10 }, (_, i) => (new Date().getFullYear() - 2 + i).toString())

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <Card className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-lg">
        <CardHeader className="border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-xl">
                <Calendar className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <CardTitle className="text-2xl font-bold">Feiertage verwalten</CardTitle>
            </div>
            <Button
              onClick={() => openDialog()}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
            >
              <Plus className="h-4 w-4 mr-2" />
              Feiertag hinzufügen
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          {/* Filter */}
          <div className="flex flex-wrap gap-4 mb-6">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setSelectedYear((parseInt(selectedYear) - 1).toString())}
                className="rounded-lg"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-28 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map(year => (
                    <SelectItem key={year} value={year}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setSelectedYear((parseInt(selectedYear) + 1).toString())}
                className="rounded-lg"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <Select value={filterBundesland} onValueChange={setFilterBundesland}>
              <SelectTrigger className="w-48 rounded-xl">
                <SelectValue placeholder="Bundesland" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Alle Bundesländer</SelectItem>
                {BUNDESLAENDER.slice(1).map(bl => (
                  <SelectItem key={bl.value} value={bl.value}>{bl.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="ml-auto text-sm text-slate-500">
              {holidays.length} Feiertage gefunden
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Table */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : holidays.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Keine Feiertage für {selectedYear} gefunden.</p>
              <p className="text-sm mt-2">Klicken Sie auf "Feiertag hinzufügen", um einen neuen Feiertag zu erstellen.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32">Datum</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="w-48">Bundesland</TableHead>
                  <TableHead className="w-24 text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {holidays.map(holiday => (
                  <TableRow key={holiday.id}>
                    <TableCell className="font-medium">
                      {format(parseISO(holiday.date), 'dd.MM.yyyy', { locale: de })}
                    </TableCell>
                    <TableCell>{holiday.name}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                        holiday.bundesland === 'ALL'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                      }`}>
                        {BUNDESLAENDER.find(bl => bl.value === holiday.bundesland)?.label || holiday.bundesland}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openDialog(holiday)}
                        className="h-8 w-8"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(holiday.id)}
                        disabled={isDeleting === holiday.id}
                        className="h-8 w-8 text-red-600 hover:text-red-700"
                      >
                        {isDeleting === holiday.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog für Hinzufügen/Bearbeiten */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl bg-white dark:bg-slate-800">
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-red-600" />
            {editingHoliday ? 'Feiertag bearbeiten' : 'Neuer Feiertag'}
          </DialogTitle>

          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="date">Datum *</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                className="rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="z.B. Neujahr"
                className="rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bundesland">Bundesland</Label>
              <Select
                value={formData.bundesland}
                onValueChange={(value) => setFormData(prev => ({ ...prev, bundesland: value }))}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BUNDESLAENDER.map(bl => (
                    <SelectItem key={bl.value} value={bl.value}>{bl.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setDialogOpen(false)}
                className="rounded-xl"
              >
                Abbrechen
              </Button>
              <Button
                onClick={handleSave}
                disabled={!formData.date || !formData.name || isSaving}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Speichern...
                  </>
                ) : (
                  'Speichern'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
