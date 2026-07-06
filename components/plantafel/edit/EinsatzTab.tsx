'use client'

import { useState, useMemo, useCallback } from 'react'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Trash2, Plus, Pencil, CheckCircle2 } from 'lucide-react'
import { TimeEntryForm } from '@/components/TimeEntryForm'
import type {
  PlantafelEvent,
  CreatePlantafelAssignmentRequest,
  UpdatePlantafelAssignmentRequest,
} from '../types'
import type { Employee, Project, TimeEntry } from '../../../types'

interface EinsatzTabProps {
  projektId: string
  project: Project
  einsatz?: PlantafelEvent | null
  defaults?: { start?: Date; end?: Date; mitarbeiterId?: string }
  employees: Employee[]
  events: PlantafelEvent[]
  selectedDate: string
  onCreate: (data: CreatePlantafelAssignmentRequest) => Promise<unknown>
  onUpdate: (id: string, data: UpdatePlantafelAssignmentRequest) => Promise<unknown>
  onDelete: (id: string) => Promise<unknown>
}

type AddPayload =
  | Array<{ day: string; entry: TimeEntry }>
  | string[]
  | string

/** onAdd-Eingaben von TimeEntryForm auf eine flache Liste von Zeiteinträgen normalisieren */
function normalizeEntries(entriesOrDates: AddPayload, entry?: TimeEntry): TimeEntry[] {
  if (Array.isArray(entriesOrDates) && entriesOrDates.length > 0 && typeof entriesOrDates[0] === 'object') {
    return (entriesOrDates as Array<{ day: string; entry: TimeEntry }>).map((x) => x.entry)
  }
  if (entry) {
    const days = Array.isArray(entriesOrDates) ? (entriesOrDates as string[]) : [entriesOrDates as string]
    return days.map(() => entry)
  }
  return []
}

export default function EinsatzTab({
  projektId,
  project,
  einsatz,
  defaults,
  employees,
  events,
  selectedDate,
  onCreate,
  onUpdate,
  onDelete,
}: EinsatzTabProps) {
  const [editTarget, setEditTarget] = useState<PlantafelEvent | null>(einsatz || null)
  const [showForm, setShowForm] = useState(Boolean(einsatz || defaults?.start))
  const [isSaving, setIsSaving] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const projektEinsaetze = useMemo(
    () =>
      events
        .filter((e) => e.sourceType === 'einsatz' && e.projektId === projektId)
        .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()),
    [events, projektId]
  )

  const employeeByName = useMemo(() => {
    const map = new Map<string, string>()
    employees.forEach((e) => map.set(e.name, e.id))
    return map
  }, [employees])

  // Zeiteintrag (aus dem Projektformular) -> Einsatz-Balken (PlantafelAssignment)
  const entryToAssignment = useCallback(
    (e: TimeEntry): CreatePlantafelAssignmentRequest => {
      const mitarbeiterId = e.isExternal ? null : employeeByName.get(e.name) ?? null
      const rolle = e.isExternal
        ? e.externalFunctionSummary || String(e.funktion || '')
        : String(e.funktion || '')
      return {
        mitarbeiterId,
        projektId,
        von: new Date(e.start).toISOString(),
        bis: new Date(e.ende).toISOString(),
        rolle,
        notizen: e.bemerkung || '',
        bestaetigt: false,
      }
    },
    [employeeByName, projektId]
  )

  const resetForm = useCallback(() => {
    setEditTarget(null)
    setShowForm(false)
    setConfirmDeleteId(null)
  }, [])

  // Formular-Absenden: pro Tag/Mitarbeiter einen Einsatz anlegen; im Edit-Modus
  // den bearbeiteten Einsatz aktualisieren, weitere als neue anlegen.
  const handleFormAdd = useCallback(
    async (entriesOrDates: AddPayload, entry?: TimeEntry) => {
      const entries = normalizeEntries(entriesOrDates, entry)
      if (entries.length === 0) return
      setIsSaving(true)
      try {
        if (editTarget) {
          const [first, ...rest] = entries
          // bestätigt-Status des Einsatzes beim Bearbeiten erhalten
          await onUpdate(editTarget.sourceId, {
            ...entryToAssignment(first),
            bestaetigt: editTarget.bestaetigt ?? false,
          })
          for (const e of rest) await onCreate(entryToAssignment(e))
        } else {
          for (const e of entries) await onCreate(entryToAssignment(e))
        }
        setSuccess(true)
        resetForm()
      } finally {
        setIsSaving(false)
      }
    },
    [editTarget, entryToAssignment, onCreate, onUpdate, resetForm]
  )

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

  // Prefill für den Edit-Modus: Einsatz -> Zeiteintrag-Formularwerte
  const initialEntry = useMemo(() => {
    if (!editTarget) return undefined
    return {
      id: editTarget.sourceId,
      name: editTarget.mitarbeiterName || '',
      funktion: editTarget.rolle || '',
      start: new Date(editTarget.start).toISOString(),
      ende: new Date(editTarget.end).toISOString(),
      bemerkung: editTarget.notes || '',
    } as Partial<TimeEntry>
  }, [editTarget])

  const formDate = editTarget
    ? format(new Date(editTarget.start), 'yyyy-MM-dd')
    : defaults?.start
      ? format(defaults.start, 'yyyy-MM-dd')
      : selectedDate

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

      {/* Formular (anlegen/bearbeiten) – identisch zum Projekt-Zeiteintrag */}
      {showForm && (
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
          <TimeEntryForm
            project={project}
            selectedDate={formDate}
            employees={employees}
            initialEntry={initialEntry}
            onAdd={handleFormAdd}
            onClose={resetForm}
          />
        </div>
      )}
    </div>
  )
}
