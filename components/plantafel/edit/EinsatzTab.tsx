'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2, Trash2, Plus, Pencil, CheckCircle2 } from 'lucide-react'
import SearchableSelect from '../SearchableSelect'
import type {
  PlantafelEvent,
  CreatePlantafelAssignmentRequest,
  UpdatePlantafelAssignmentRequest,
} from '../types'
import type { Employee } from '@/types/main'

interface EinsatzTabProps {
  projektId: string
  einsatz?: PlantafelEvent | null
  defaults?: { start?: Date; end?: Date; mitarbeiterId?: string }
  employees: Employee[]
  events: PlantafelEvent[]
  onCreate: (data: CreatePlantafelAssignmentRequest) => Promise<unknown>
  onUpdate: (id: string, data: UpdatePlantafelAssignmentRequest) => Promise<unknown>
  onDelete: (id: string) => Promise<unknown>
}

interface FormState {
  mitarbeiterId: string
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
  von: '',
  bis: '',
  rolle: '',
  notizen: '',
  bestaetigt: false,
  setupDate: '',
  dismantleDate: '',
}

function eventToForm(e: PlantafelEvent): FormState {
  return {
    mitarbeiterId: e.mitarbeiterId || '',
    von: format(new Date(e.start), "yyyy-MM-dd'T'HH:mm"),
    bis: format(new Date(e.end), "yyyy-MM-dd'T'HH:mm"),
    rolle: e.rolle || '',
    notizen: e.notes || '',
    bestaetigt: e.bestaetigt || false,
    setupDate: e.setupDate || '',
    dismantleDate: e.dismantleDate || '',
  }
}

export default function EinsatzTab({
  projektId,
  einsatz,
  defaults,
  employees,
  events,
  onCreate,
  onUpdate,
  onDelete,
}: EinsatzTabProps) {
  const [editTarget, setEditTarget] = useState<PlantafelEvent | null>(einsatz || null)
  const [showForm, setShowForm] = useState(Boolean(einsatz || defaults?.start))
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [isSaving, setIsSaving] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Formular initialisieren: bearbeiteter Einsatz > Defaults (Slot/Drag) > leer
  useEffect(() => {
    if (editTarget) {
      setForm(eventToForm(editTarget))
    } else {
      setForm({
        ...EMPTY_FORM,
        mitarbeiterId: defaults?.mitarbeiterId || '',
        von: defaults?.start ? format(defaults.start, "yyyy-MM-dd'T'HH:mm") : '',
        bis: defaults?.end ? format(defaults.end, "yyyy-MM-dd'T'HH:mm") : '',
      })
    }
  }, [editTarget, defaults])

  const projektEinsaetze = useMemo(
    () =>
      events
        .filter((e) => e.sourceType === 'einsatz' && e.projektId === projektId)
        .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()),
    [events, projektId]
  )

  const activeEmployees = useMemo(
    () => employees.filter((e) => e.status === 'aktiv' || e.id === form.mitarbeiterId),
    [employees, form.mitarbeiterId]
  )

  const updateField = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setSuccess(false)
  }, [])

  const resetForm = useCallback(() => {
    setEditTarget(null)
    setShowForm(false)
    setConfirmDeleteId(null)
  }, [])

  const handleSave = async () => {
    if (!projektId || !form.von || !form.bis) return
    setIsSaving(true)
    try {
      const payload: CreatePlantafelAssignmentRequest = {
        mitarbeiterId: form.mitarbeiterId || null,
        projektId,
        von: new Date(form.von).toISOString(),
        bis: new Date(form.bis).toISOString(),
        rolle: form.rolle,
        notizen: form.notizen,
        bestaetigt: form.bestaetigt,
        setupDate: form.setupDate || undefined,
        dismantleDate: form.dismantleDate || undefined,
      }
      if (editTarget) {
        await onUpdate(editTarget.sourceId, payload)
      } else {
        await onCreate(payload)
      }
      setSuccess(true)
      resetForm()
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (sourceId: string) => {
    if (confirmDeleteId !== sourceId) {
      setConfirmDeleteId(sourceId)
      return
    }
    setIsSaving(true)
    try {
      await onDelete(sourceId)
      if (editTarget?.sourceId === sourceId) resetForm()
      setConfirmDeleteId(null)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Bestehende Einsätze des Projekts */}
      {!showForm && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
              Geplante Einsätze
            </p>
            <Button size="sm" onClick={() => { setEditTarget(null); setShowForm(true) }}>
              <Plus className="h-4 w-4 mr-1" />
              Neuer Einsatz
            </Button>
          </div>

          {projektEinsaetze.length > 0 ? (
            <div className="space-y-1.5">
              {projektEinsaetze.map((e) => (
                <div
                  key={e.id}
                  className="flex items-center justify-between rounded-md border border-slate-200 dark:border-slate-700 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-slate-800 dark:text-slate-200 truncate">
                      {format(new Date(e.start), 'dd.MM.yy HH:mm', { locale: de })}
                      {' – '}
                      {format(new Date(e.end), 'dd.MM.yy HH:mm', { locale: de })}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {e.mitarbeiterName || 'Nicht zugewiesen'}
                      {e.rolle ? ` · ${e.rolle}` : ''}
                      {e.bestaetigt ? ' · bestätigt' : ' · unbestätigt'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => { setEditTarget(e); setShowForm(true) }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={isSaving}
                      className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                      onClick={() => handleDelete(e.sourceId)}
                    >
                      {confirmDeleteId === e.sourceId ? (
                        <span className="text-xs">Wirklich?</span>
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Keine geplanten Einsätze für dieses Projekt im sichtbaren Zeitraum.
            </p>
          )}

          {success && (
            <p className="flex items-center gap-1 text-sm text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" /> Einsatz gespeichert
            </p>
          )}
        </>
      )}

      {/* Formular (anlegen/bearbeiten) */}
      {showForm && (
        <div className="space-y-4 rounded-lg border border-slate-200 dark:border-slate-700 p-3">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
            {editTarget ? 'Einsatz bearbeiten' : 'Neuer Einsatz'}
          </p>

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

          <div className="space-y-1.5">
            <Label>Rolle / Funktion</Label>
            <Input
              value={form.rolle}
              onChange={(e) => updateField('rolle', e.target.value)}
              placeholder="z.B. Bauleiter, Monteur..."
            />
          </div>

          <div className="space-y-1.5">
            <Label>Notizen</Label>
            <Input
              value={form.notizen}
              onChange={(e) => updateField('notizen', e.target.value)}
              placeholder="Optionale Hinweise..."
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="einsatz-bestaetigt"
              checked={form.bestaetigt}
              onCheckedChange={(v) => updateField('bestaetigt', v === true)}
            />
            <Label htmlFor="einsatz-bestaetigt" className="text-sm cursor-pointer">
              Einsatz bestätigt
            </Label>
          </div>

          <div className="flex items-center justify-between pt-1">
            <div>
              {editTarget && (
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={isSaving}
                  onClick={() => handleDelete(editTarget.sourceId)}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  {confirmDeleteId === editTarget.sourceId ? 'Wirklich löschen?' : 'Löschen'}
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={resetForm} disabled={isSaving}>
                Abbrechen
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={isSaving || !form.von || !form.bis}
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : null}
                {editTarget ? 'Aktualisieren' : 'Erstellen'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
