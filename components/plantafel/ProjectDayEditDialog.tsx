'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Save, Trash2, Plus, ExternalLink, AlertTriangle } from 'lucide-react'
import { useVehicles } from '@/hooks/useVehicles'
import { ProjectsApi } from '@/lib/api/projects'
import { ProjectVehiclesApi } from '@/lib/api/projectVehicles'
import type { PlantafelDayProject, PlantafelDayVehicle } from './types'

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'aktiv', label: 'Aktiv' },
  { value: 'abgeschlossen', label: 'Abgeschlossen' },
  { value: 'fertiggestellt', label: 'Fertiggestellt' },
  { value: 'geleistet', label: 'Geleistet' },
  { value: 'teilweise_abgerechnet', label: 'Teilweise abgerechnet' },
  { value: 'kein Status', label: 'Kein Status' },
]

interface ProjectDayEditDialogProps {
  project: PlantafelDayProject | null
  dateKey: string
  open: boolean
  onClose: () => void
  onSaved: () => void
  onOpenDetail: (projectId: string) => void
}

interface EditForm {
  status: string
  auftraggeber: string
  baustelle: string
  auftragsnummer: string
  sapNummer: string
  telefonnummer: string
  atwsImEinsatz: boolean
  anzahlAtws: number
}

function toForm(p: PlantafelDayProject): EditForm {
  return {
    status: p.status || 'aktiv',
    auftraggeber: p.auftraggeber || '',
    baustelle: p.baustelle || '',
    auftragsnummer: p.auftragsnummer || '',
    sapNummer: p.sapNummer || '',
    telefonnummer: p.telefonnummer || '',
    atwsImEinsatz: Boolean(p.atwsImEinsatz),
    anzahlAtws: Number(p.anzahlAtws) || 0,
  }
}

export default function ProjectDayEditDialog({
  project,
  dateKey,
  open,
  onClose,
  onSaved,
  onOpenDetail,
}: ProjectDayEditDialogProps) {
  const { vehicles: masterVehicles } = useVehicles()
  const [form, setForm] = useState<EditForm | null>(null)
  const [dayVehicles, setDayVehicles] = useState<PlantafelDayVehicle[]>([])
  const [vehicleToAdd, setVehicleToAdd] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isVehicleBusy, setIsVehicleBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    if (project && open) {
      setForm(toForm(project))
      setDayVehicles(project.fahrzeuge || [])
      setVehicleToAdd('')
      setError(null)
      setHasChanges(false)
    }
  }, [project, open])

  const updateField = useCallback(<K extends keyof EditForm>(key: K, value: EditForm[K]) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev))
    setHasChanges(true)
  }, [])

  const assignedPlates = useMemo(
    () => new Set(dayVehicles.map((v) => v.licensePlate).filter(Boolean)),
    [dayVehicles]
  )

  const availableVehicles = useMemo(
    () => masterVehicles.filter((v) => !assignedPlates.has(v.licensePlate)),
    [masterVehicles, assignedPlates]
  )

  const handleClose = useCallback(() => {
    if (hasChanges) onSaved()
    onClose()
  }, [hasChanges, onSaved, onClose])

  const handleSaveMasterData = async () => {
    if (!project || !form) return
    if (
      !form.auftraggeber.trim() ||
      !form.baustelle.trim() ||
      !form.auftragsnummer.trim() ||
      !form.sapNummer.trim() ||
      !form.telefonnummer.trim() ||
      (form.atwsImEinsatz && form.anzahlAtws < 1)
    ) {
      setError('Bitte alle Felder korrekt ausfüllen (bei ATWS mindestens Anzahl 1).')
      return
    }
    setIsSaving(true)
    setError(null)
    try {
      await ProjectsApi.update(project.id, {
        status: form.status,
        auftraggeber: form.auftraggeber,
        baustelle: form.baustelle,
        auftragsnummer: form.auftragsnummer,
        sapNummer: form.sapNummer,
        telefonnummer: form.telefonnummer,
        atwsImEinsatz: form.atwsImEinsatz,
        anzahlAtws: form.atwsImEinsatz ? form.anzahlAtws : 0,
      } as Parameters<typeof ProjectsApi.update>[1])
      onSaved()
      onClose()
    } catch {
      setError('Speichern fehlgeschlagen. Bitte erneut versuchen.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleAddVehicle = async () => {
    if (!project || !vehicleToAdd) return
    const master = masterVehicles.find((v) => v.id === vehicleToAdd)
    if (!master) return
    setIsVehicleBusy(true)
    setError(null)
    try {
      await ProjectVehiclesApi.assign(project.id, {
        date: dateKey,
        vehicle: {
          id: master.id,
          type: master.type,
          licensePlate: master.licensePlate,
          kilometers: master.kilometers || '',
        },
      })
      setDayVehicles((prev) => [
        ...prev,
        { id: master.id, type: master.type, licensePlate: master.licensePlate, kilometers: master.kilometers || '' },
      ])
      setVehicleToAdd('')
      setHasChanges(true)
    } catch {
      setError('Fahrzeug konnte nicht zugewiesen werden.')
    } finally {
      setIsVehicleBusy(false)
    }
  }

  const handleRemoveVehicle = async (vehicleId?: string) => {
    if (!project || !vehicleId) return
    setIsVehicleBusy(true)
    setError(null)
    try {
      await ProjectVehiclesApi.unassign(project.id, { date: dateKey, vehicleId })
      setDayVehicles((prev) => prev.filter((v) => v.id !== vehicleId))
      setHasChanges(true)
    } catch {
      setError('Fahrzeug konnte nicht entfernt werden.')
    } finally {
      setIsVehicleBusy(false)
    }
  }

  if (!project || !form) return null

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogTitle className="flex items-center justify-between gap-2 pr-6">
          <span className="truncate">{project.name}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenDetail(project.id)}
            className="shrink-0"
          >
            <ExternalLink className="h-4 w-4 mr-1" />
            Projektseite
          </Button>
        </DialogTitle>

        <div className="space-y-5">
          {/* Stammdaten */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => updateField('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Auftraggeber</Label>
              <Input value={form.auftraggeber} onChange={(e) => updateField('auftraggeber', e.target.value)} />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>Baustelle</Label>
              <Input value={form.baustelle} onChange={(e) => updateField('baustelle', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Auftragsnummer</Label>
              <Input value={form.auftragsnummer} onChange={(e) => updateField('auftragsnummer', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>SAP-Nummer</Label>
              <Input value={form.sapNummer} onChange={(e) => updateField('sapNummer', e.target.value)} />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>Telefon / Ansprechpartner</Label>
              <Input value={form.telefonnummer} onChange={(e) => updateField('telefonnummer', e.target.value)} />
            </div>
          </div>

          {/* ATWS */}
          <div className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 p-3">
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-white">ATWS im Einsatz</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Aktivieren und Anzahl angeben</p>
            </div>
            <div className="flex items-center gap-3">
              {form.atwsImEinsatz && (
                <Input
                  type="number"
                  min={1}
                  className="w-20 h-8"
                  value={form.anzahlAtws}
                  onChange={(e) => updateField('anzahlAtws', Number(e.target.value) || 0)}
                />
              )}
              <Switch
                checked={form.atwsImEinsatz}
                onCheckedChange={(v) => updateField('atwsImEinsatz', v)}
              />
            </div>
          </div>

          {/* Fahrzeuge (tagesbezogen) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Fahrzeuge ({dateKey})</Label>
            </div>
            {dayVehicles.length > 0 ? (
              <div className="space-y-1.5">
                {dayVehicles.map((v) => (
                  <div
                    key={v.id || v.licensePlate}
                    className="flex items-center justify-between rounded-md border border-slate-200 dark:border-slate-700 px-3 py-1.5"
                  >
                    <span className="text-sm text-slate-800 dark:text-slate-200">
                      {[v.type, v.licensePlate].filter(Boolean).join(' ')}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={isVehicleBusy}
                      onClick={() => handleRemoveVehicle(v.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 h-7 px-2"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400">Keine Fahrzeuge für diesen Tag zugewiesen.</p>
            )}

            <div className="flex items-center gap-2">
              <Select value={vehicleToAdd} onValueChange={setVehicleToAdd}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Fahrzeug auswählen..." />
                </SelectTrigger>
                <SelectContent>
                  {availableVehicles.length > 0 ? (
                    availableVehicles.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {[v.type, v.licensePlate].filter(Boolean).join(' ')}
                      </SelectItem>
                    ))
                  ) : (
                    <div className="px-2 py-1.5 text-xs text-slate-400">Keine weiteren Fahrzeuge</div>
                  )}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" disabled={!vehicleToAdd || isVehicleBusy} onClick={handleAddVehicle}>
                {isVehicleBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3">
              <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
              <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={handleClose} disabled={isSaving}>Schließen</Button>
            <Button onClick={handleSaveMasterData} disabled={isSaving} className="bg-blue-600 hover:bg-blue-700 text-white">
              {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Speichern
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
