'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import SearchableSelect from './SearchableSelect'
import { Trash2 } from 'lucide-react'
import type { PlantafelEvent, CreatePlantafelAssignmentRequest } from './types'
import type { Employee, Project } from '@/types/main'

interface AssignmentDialogProps {
  open: boolean
  onClose: () => void
  event?: PlantafelEvent | null
  employees: Employee[]
  projects: Project[]
  onSave: (data: CreatePlantafelAssignmentRequest) => Promise<void>
  onUpdate: (id: string, data: Partial<CreatePlantafelAssignmentRequest>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  defaultStart?: Date
  defaultEnd?: Date
  defaultResourceId?: string
  defaultProjektId?: string
  defaultMitarbeiterId?: string
}

interface FormState {
  mitarbeiterId: string
  projektId: string
  von: string
  bis: string
  rolle: string
  notizen: string
  bestaetigt: boolean
  setupDate: string
  dismantleDate: string
}

const EMPTY_FORM: FormState = {
  mitarbeiterId: '',
  projektId: '',
  von: '',
  bis: '',
  rolle: '',
  notizen: '',
  bestaetigt: false,
  setupDate: '',
  dismantleDate: '',
}

export default function AssignmentDialog({
  open,
  onClose,
  event,
  employees,
  projects,
  onSave,
  onUpdate,
  onDelete,
  defaultStart,
  defaultEnd,
  defaultResourceId,
  defaultProjektId,
  defaultMitarbeiterId,
}: AssignmentDialogProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [isSaving, setIsSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const isEdit = Boolean(event)

  useEffect(() => {
    if (!open) {
      setConfirmDelete(false)
      return
    }

    if (event) {
      setForm({
        mitarbeiterId: event.mitarbeiterId || '',
        projektId: event.projektId || '',
        von: format(event.start, "yyyy-MM-dd'T'HH:mm"),
        bis: format(event.end, "yyyy-MM-dd'T'HH:mm"),
        rolle: event.rolle || '',
        notizen: event.notes || '',
        bestaetigt: event.bestaetigt || false,
        setupDate: event.setupDate || '',
        dismantleDate: event.dismantleDate || '',
      })
    } else {
      setForm({
        ...EMPTY_FORM,
        mitarbeiterId: defaultMitarbeiterId || defaultResourceId || '',
        projektId: defaultProjektId || '',
        von: defaultStart ? format(defaultStart, "yyyy-MM-dd'T'HH:mm") : '',
        bis: defaultEnd ? format(defaultEnd, "yyyy-MM-dd'T'HH:mm") : '',
      })
    }
  }, [open, event, defaultStart, defaultEnd, defaultResourceId, defaultProjektId, defaultMitarbeiterId])

  const handleSave = async () => {
    if (!form.projektId || !form.von || !form.bis) return
    setIsSaving(true)
    try {
      const payload: CreatePlantafelAssignmentRequest = {
        mitarbeiterId: form.mitarbeiterId || null,
        projektId: form.projektId,
        von: new Date(form.von).toISOString(),
        bis: new Date(form.bis).toISOString(),
        rolle: form.rolle,
        notizen: form.notizen,
        bestaetigt: form.bestaetigt,
        setupDate: form.setupDate || undefined,
        dismantleDate: form.dismantleDate || undefined,
      }

      if (isEdit && event) {
        await onUpdate(event.sourceId, payload)
      } else {
        await onSave(payload)
      }
      onClose()
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!event) return
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    setIsSaving(true)
    try {
      await onDelete(event.sourceId)
      onClose()
    } finally {
      setIsSaving(false)
    }
  }

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const activeProjects = projects.filter((p) => p.status === 'aktiv' || p.id === form.projektId)
  const activeEmployees = employees.filter((e) => e.status === 'aktiv' || e.id === form.mitarbeiterId)

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Einsatz bearbeiten' : 'Neuer Einsatz'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Projekt */}
          <div className="space-y-1.5">
            <Label>Projekt *</Label>
            <SearchableSelect
              value={form.projektId}
              onValueChange={(v) => updateField('projektId', v)}
              options={activeProjects.map((p) => ({ value: p.id, label: p.name }))}
              placeholder="Projekt auswählen"
              emptyLabel="Kein Projekt gefunden"
              searchPlaceholder="Projekt suchen..."
            />
          </div>

          {/* Mitarbeiter */}
          <div className="space-y-1.5">
            <Label>Mitarbeiter</Label>
            <SearchableSelect
              value={form.mitarbeiterId || '__none__'}
              onValueChange={(v) => updateField('mitarbeiterId', v === '__none__' ? '' : v)}
              options={[
                { value: '__none__', label: 'Nicht zugewiesen' },
                ...activeEmployees.map((e) => ({ value: e.id, label: e.name })),
              ]}
              placeholder="Mitarbeiter auswählen"
              emptyLabel="Kein Mitarbeiter gefunden"
              searchPlaceholder="Mitarbeiter suchen..."
            />
          </div>

          {/* Zeitraum */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Von *</Label>
              <Input
                type="datetime-local"
                value={form.von}
                onChange={(e) => updateField('von', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Bis *</Label>
              <Input
                type="datetime-local"
                value={form.bis}
                onChange={(e) => updateField('bis', e.target.value)}
              />
            </div>
          </div>

          {/* Aufbau / Abbau */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Aufbau-Datum</Label>
              <Input
                type="date"
                value={form.setupDate}
                onChange={(e) => updateField('setupDate', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Abbau-Datum</Label>
              <Input
                type="date"
                value={form.dismantleDate}
                onChange={(e) => updateField('dismantleDate', e.target.value)}
              />
            </div>
          </div>

          {/* Rolle */}
          <div className="space-y-1.5">
            <Label>Rolle / Funktion</Label>
            <Input
              value={form.rolle}
              onChange={(e) => updateField('rolle', e.target.value)}
              placeholder="z.B. Bauleiter, Monteur..."
            />
          </div>

          {/* Notizen */}
          <div className="space-y-1.5">
            <Label>Notizen</Label>
            <Input
              value={form.notizen}
              onChange={(e) => updateField('notizen', e.target.value)}
              placeholder="Optionale Hinweise..."
            />
          </div>

          {/* Bestätigt */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="bestaetigt"
              checked={form.bestaetigt}
              onCheckedChange={(v) => updateField('bestaetigt', v === true)}
            />
            <Label htmlFor="bestaetigt" className="text-sm cursor-pointer">
              Einsatz bestätigt
            </Label>
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between">
          <div>
            {isEdit && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={isSaving}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                {confirmDelete ? 'Wirklich löschen?' : 'Löschen'}
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={isSaving}>
              Abbrechen
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || !form.projektId || !form.von || !form.bis}
            >
              {isSaving ? 'Speichern...' : isEdit ? 'Aktualisieren' : 'Erstellen'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
