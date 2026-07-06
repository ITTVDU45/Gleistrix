'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { format, addYears } from 'date-fns'
import { de } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Trash2, Plus, Pencil, CheckCircle2 } from 'lucide-react'
import { TimeEntryForm } from '@/components/TimeEntryForm'
import { PlantafelApi } from '@/lib/api/plantafel'
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
  /** Legt zusätzlich echte Projekt-Zeiteinträge an (Pause/Fahrt/Extra/Feiertag → Abrechnung) */
  onAddTimeEntries: (
    entriesOrDates: Array<{ day: string; entry: unknown }> | string[] | string,
    entry?: unknown
  ) => Promise<void>
  /** Löscht den verknüpften Projekt-Zeiteintrag beim Bearbeiten/Löschen eines Einsatzes */
  onDeleteTimeEntry: (date: string, entryId: string) => Promise<void>
}

type AddPayload =
  | Array<{ day: string; entry: TimeEntry }>
  | string[]
  | string

/** onAdd-Eingaben von TimeEntryForm auf {day, entry}-Paare normalisieren */
function toPayloadItems(entriesOrDates: AddPayload, entry?: TimeEntry): Array<{ day: string; entry: TimeEntry }> {
  if (Array.isArray(entriesOrDates) && entriesOrDates.length > 0 && typeof entriesOrDates[0] === 'object') {
    return entriesOrDates as Array<{ day: string; entry: TimeEntry }>
  }
  if (entry) {
    const days = Array.isArray(entriesOrDates) ? (entriesOrDates as string[]) : [entriesOrDates as string]
    return days.map((day) => ({ day, entry }))
  }
  return []
}

/** Eindeutige Verknüpfungs-ID für ein Einsatz/Zeiteintrag-Paar */
function genLinkId(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  } catch {
    /* fallback unten */
  }
  return `link-${Date.now()}-${Math.random().toString(36).slice(2)}`
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
  onAddTimeEntries,
  onDeleteTimeEntry,
}: EinsatzTabProps) {
  const [editTarget, setEditTarget] = useState<PlantafelEvent | null>(einsatz || null)
  const [showForm, setShowForm] = useState(Boolean(einsatz || defaults?.start))
  const [isSaving, setIsSaving] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Projekt-scoped Einsatz-Liste: lädt unabhängig vom sichtbaren Kalenderbereich
  // und wird nach jeder Mutation sofort neu geladen (Fallback: events-Prop).
  const [localEinsaetze, setLocalEinsaetze] = useState<PlantafelEvent[] | null>(null)

  const loadEinsaetze = useCallback(async () => {
    if (!projektId) return
    const beginn = String((project as { datumBeginn?: string }).datumBeginn ?? '').slice(0, 10)
    const ende = String((project as { datumEnde?: string }).datumEnde ?? '').slice(0, 10)
    const from = beginn || format(addYears(new Date(), -1), 'yyyy-MM-dd')
    const to = ende || format(addYears(new Date(), 1), 'yyyy-MM-dd')
    try {
      const res = await PlantafelApi.getAssignments({
        from,
        to,
        projectIds: [projektId],
        showProjects: false,
        showAbsences: false,
        showGermanHolidays: false,
        showIslamicHolidays: false,
      })
      if (res.success && res.data) {
        const list = res.data.events
          .filter((e) => e.sourceType === 'einsatz' && e.projektId === projektId)
          .map((e) => ({ ...e, start: new Date(e.start), end: new Date(e.end) }))
        setLocalEinsaetze(list)
      }
    } catch {
      // Fallback bleibt die events-Prop
    }
  }, [projektId, project])

  useEffect(() => {
    loadEinsaetze()
  }, [loadEinsaetze])

  const projektEinsaetze = useMemo(() => {
    const source =
      localEinsaetze ?? events.filter((e) => e.sourceType === 'einsatz' && e.projektId === projektId)
    return [...source].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
  }, [localEinsaetze, events, projektId])

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

  // Verknüpfte Projekt-Zeiteinträge zu einer einsatzLinkId finden (day + entryId)
  const findLinkedTimeEntries = useCallback(
    (linkId: string): Array<{ day: string; id: string }> => {
      const zeiten =
        ((project as { mitarbeiterZeiten?: Record<string, unknown[]> }).mitarbeiterZeiten) || {}
      const out: Array<{ day: string; id: string }> = []
      for (const [day, arr] of Object.entries(zeiten)) {
        if (!Array.isArray(arr)) continue
        for (const e of arr as Array<Record<string, unknown>>) {
          if (e && e['einsatzLinkId'] === linkId && typeof e['id'] === 'string') {
            out.push({ day, id: e['id'] as string })
          }
        }
      }
      return out
    },
    [project]
  )

  const resetForm = useCallback(() => {
    setEditTarget(null)
    setShowForm(false)
    setConfirmDeleteId(null)
  }, [])

  // Formular-Absenden: Anlegen erzeugt verknüpfte Paare (Zeiteintrag + Balken);
  // Bearbeiten aktualisiert Balken und ersetzt den verknüpften Zeiteintrag.
  const handleFormAdd = useCallback(
    async (entriesOrDates: AddPayload, entry?: TimeEntry) => {
      const items = toPayloadItems(entriesOrDates, entry)
      if (items.length === 0) return
      setIsSaving(true)
      try {
        if (editTarget) {
          const [firstItem, ...restItems] = items
          // bestätigt-Status erhalten
          await onUpdate(editTarget.sourceId, {
            ...entryToAssignment(firstItem.entry),
            bestaetigt: editTarget.bestaetigt ?? false,
          })
          // Verknüpften Zeiteintrag ersetzen (alte löschen, neuen mit gleicher LinkId anlegen)
          if (editTarget.einsatzLinkId) {
            const linked = findLinkedTimeEntries(editTarget.einsatzLinkId)
            for (const l of linked) await onDeleteTimeEntry(l.day, l.id)
            await onAddTimeEntries([
              { day: firstItem.day, entry: { ...firstItem.entry, einsatzLinkId: editTarget.einsatzLinkId } },
            ])
          }
          // Zusätzlich gewählte Tage → jeweils neues verknüpftes Paar
          for (const it of restItems) {
            const linkId = genLinkId()
            await onAddTimeEntries([{ day: it.day, entry: { ...it.entry, einsatzLinkId: linkId } }])
            await onCreate({ ...entryToAssignment(it.entry), einsatzLinkId: linkId })
          }
        } else {
          // Anlegen: pro Tag/Mitarbeiter ein verknüpftes Paar (Zeiteintrag + Balken)
          const stamped = items.map((it) => ({ ...it, linkId: genLinkId() }))
          await onAddTimeEntries(
            stamped.map((s) => ({ day: s.day, entry: { ...s.entry, einsatzLinkId: s.linkId } }))
          )
          for (const s of stamped) {
            await onCreate({ ...entryToAssignment(s.entry), einsatzLinkId: s.linkId })
          }
        }
        await loadEinsaetze()
        setSuccess(true)
        resetForm()
      } finally {
        setIsSaving(false)
      }
    },
    [
      editTarget,
      entryToAssignment,
      onCreate,
      onUpdate,
      onAddTimeEntries,
      onDeleteTimeEntry,
      findLinkedTimeEntries,
      resetForm,
      loadEinsaetze,
    ]
  )

  const handleDelete = async (event: PlantafelEvent) => {
    const sourceId = event.sourceId
    if (confirmDeleteId !== sourceId) {
      setConfirmDeleteId(sourceId)
      return
    }
    setIsSaving(true)
    try {
      // Verknüpften Zeiteintrag mitlöschen
      if (event.einsatzLinkId) {
        const linked = findLinkedTimeEntries(event.einsatzLinkId)
        for (const l of linked) await onDeleteTimeEntry(l.day, l.id)
      }
      await onDelete(sourceId)
      await loadEinsaetze()
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
                      onClick={() => handleDelete(e)}
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
