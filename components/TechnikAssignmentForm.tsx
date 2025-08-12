"use client";
import React, { useState, useEffect } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Checkbox } from './ui/checkbox'
import { Alert } from './ui/alert'
import { format, parseISO, addDays } from 'date-fns'
import { de } from 'date-fns/locale'
import type { Project } from '../types'

interface TechnikAssignmentFormProps {
  project: Project
  onAssign: (dateOrDates: string | string[], technik: { name: string; anzahl: number; meterlaenge: number; selectedDays?: string[] }) => void
  onClose: () => void
  editMode?: boolean
  initialValues?: {
    selectedTechnik?: string
    selectedDays?: string[]
    anzahl?: number
    meterlaenge?: number
  }
}

export default function TechnikAssignmentForm({ 
  project, 
  onAssign, 
  onClose,
  editMode = false, 
  initialValues 
}: TechnikAssignmentFormProps) {
  const [technikName, setTechnikName] = useState<string>(initialValues?.selectedTechnik || '')
  const [anzahl, setAnzahl] = useState<number>(initialValues?.anzahl || 1)
  const [meterlaenge, setMeterlaenge] = useState<number>(initialValues?.meterlaenge || 0)
  const [selectedDays, setSelectedDays] = useState<string[]>(initialValues?.selectedDays || [])
  const [error, setError] = useState<string | null>(null)
  const [selectAllDays, setSelectAllDays] = React.useState(false)

  // Initialisiere selectAllDays basierend auf selectedDays
  React.useEffect(() => {
    if (initialValues?.selectedDays && initialValues.selectedDays.length > 0) {
      const projectDays = getProjectDays(project);
      setSelectAllDays(initialValues.selectedDays.length === projectDays.length);
    }
  }, [initialValues, project]);

  function getProjectDays(project: Project): string[] {
    const startDate = parseISO(project.datumBeginn)
    const endDate = parseISO(project.datumEnde)
    const days: string[] = []
    let currentDate = startDate
    while (currentDate <= endDate) {
      days.push(format(currentDate, 'yyyy-MM-dd'))
      currentDate = addDays(currentDate, 1)
    }
    return days
  }

  React.useEffect(() => {
    if (selectAllDays) {
      setSelectedDays(getProjectDays(project))
    } else if (selectedDays.length === getProjectDays(project).length) {
      setSelectedDays([])
    }
    // eslint-disable-next-line
  }, [selectAllDays])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!technikName.trim() || selectedDays.length === 0) {
      setError('Bitte füllen Sie alle Felder aus und wählen Sie mindestens einen Tag!')
      return
    }
    if (anzahl < 1) {
      setError('Die Anzahl muss mindestens 1 sein!')
      return
    }
    if (meterlaenge < 0) {
      setError('Die Meterlänge darf nicht negativ sein!')
      return
    }
    
    if (editMode) {
      const technikData = {
        name: technikName,
        anzahl: anzahl,
        meterlaenge: meterlaenge,
        selectedDays: selectedDays
      }
      await onAssign(selectedDays[0], technikData)
    } else {
      // Auswahlgesteuert: nur die gewählten Tage übergeben (oder leer, wenn keine gewählt)
      await onAssign(selectedDays, {
        name: technikName,
        anzahl: anzahl,
        meterlaenge: meterlaenge,
        selectedDays: selectedDays,
      })
    }
    onClose()
  }

  const projectDays = getProjectDays(project)

  return (
    <form onSubmit={handleSubmit} className="w-full flex flex-col gap-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="technikName" className="text-sm font-semibold text-slate-700">
            Name der Technik *
          </Label>
          <Input 
            id="technikName"
            value={technikName} 
            onChange={e => setTechnikName(e.target.value)} 
            placeholder="z.B. Absperrband, Warnleuchte"
            className="rounded-xl border-slate-200 focus:border-green-500 focus:ring-green-500 h-12"
            required 
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="anzahl" className="text-sm font-semibold text-slate-700">
              Anzahl *
            </Label>
            <Input 
              id="anzahl"
              type="number" 
              value={anzahl} 
              onChange={e => setAnzahl(parseInt(e.target.value) || 0)} 
              placeholder="1"
              className="rounded-xl border-slate-200 focus:border-green-500 focus:ring-green-500 h-12"
              required 
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="meterlaenge" className="text-sm font-semibold text-slate-700">
              Meterlänge *
            </Label>
            <Input 
              id="meterlaenge"
              type="number" 
              value={meterlaenge} 
              onChange={e => setMeterlaenge(parseFloat(e.target.value) || 0)} 
              placeholder="0"
              className="rounded-xl border-slate-200 focus:border-green-500 focus:ring-green-500 h-12"
              required 
            />
          </div>
        </div>
        <div className="flex items-center space-x-3 p-3 bg-slate-50 rounded-xl">
          <Checkbox 
            id="selectAllDays"
            checked={selectAllDays} 
            onCheckedChange={(checked) => setSelectAllDays(checked as boolean)} 
            className="rounded"
          />
          <Label htmlFor="selectAllDays" className="text-sm font-medium text-slate-700">
            Alle Tage auswählen
          </Label>
        </div>
        <div className="space-y-3">
          <Label className="text-sm font-semibold text-slate-700">
            Einsatztage auswählen *
          </Label>
          <div className="flex flex-wrap gap-2 p-3 bg-slate-50 rounded-xl max-h-32 overflow-y-auto">
            {projectDays.map(day => (
              <Button
                key={day}
                type="button"
                variant={selectedDays.includes(day) ? 'default' : 'outline'}
                size="sm"
                className={`rounded-xl transition-all duration-200 ${
                  selectedDays.includes(day) 
                    ? 'bg-green-600 hover:bg-green-700 text-white' 
                    : 'border-slate-200 hover:bg-slate-100'
                }`}
                onClick={() => {
                  setSelectedDays(prev => {
                    const next = prev.includes(day)
                      ? prev.filter(d => d !== day)
                      : [...prev, day]
                    setSelectAllDays(next.length === projectDays.length)
                    return next
                  })
                }}
              >
                {format(parseISO(day), 'dd.MM.yyyy', { locale: de })}
              </Button>
            ))}
          </div>
        </div>
      </div>
      {error && (
        <Alert variant="destructive" className="rounded-xl border-red-200 bg-red-50">
          {error}
        </Alert>
      )}
      <div className="flex gap-3 justify-end pt-4 border-t border-slate-100">
        <Button 
          variant="outline" 
          onClick={onClose} 
          className="rounded-xl h-12 px-6 border-slate-200 hover:bg-slate-50"
        >
          Abbrechen
        </Button>
        <Button 
          type="submit" 
          className="bg-green-600 hover:bg-green-700 text-white rounded-xl h-12 px-6 shadow-lg hover:shadow-xl transition-all duration-200"
        >
          {editMode ? 'Speichern' : 'Technik zuordnen'}
        </Button>
      </div>
    </form>
  )
} 