'use client'

import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { TimeEntryForm } from '@/components/TimeEntryForm'
import { EditTimeEntryForm } from '@/components/EditTimeEntryForm'
import { getProjectDays } from './projectDays'
import type { Project, Employee, TimeEntry } from '../../../types'

interface MultiDayEditData {
  updates: Array<{ day: string; entryId: string; entry: unknown }>
  newEntries: Array<{ day: string; entry: unknown }>
}

interface ZeitenTabProps {
  project: Project
  employees: Employee[]
  selectedDate: string
  onDateChange: (date: string) => void
  onAdd: (entriesOrDates: Array<{ day: string; entry: unknown }> | string[] | string, entry?: unknown) => Promise<void>
  onEdit: (data: MultiDayEditData) => Promise<void>
  onDelete: (date: string, entryId: string) => Promise<void>
  /** Öffnet das Zeit-Formular sofort (Einstieg über den Anlege-Assistenten). */
  autoOpenForm?: boolean
}

function formatTime(value?: string): string {
  if (!value) return '–'
  try {
    return format(new Date(value), 'HH:mm')
  } catch {
    return value
  }
}

function funktionLabel(e: TimeEntry): string {
  if (e.isExternal) return e.externalFunctionSummary || String(e.funktion || '')
  return String(e.funktion || '')
}

function nameLabel(e: TimeEntry): string {
  if (e.isExternal) return e.externalCompanyName || e.name || 'Extern'
  return e.name || ''
}

export default function ZeitenTab({
  project,
  employees,
  selectedDate,
  onDateChange,
  onAdd,
  onEdit,
  onDelete,
  autoOpenForm,
}: ZeitenTabProps) {
  const [showAddForm, setShowAddForm] = useState(Boolean(autoOpenForm))
  const [editEntry, setEditEntry] = useState<TimeEntry | null>(null)

  const days = useMemo(() => getProjectDays(project), [project])

  const zeitenMap = (project.mitarbeiterZeiten || {}) as Record<string, TimeEntry[]>
  const entries = zeitenMap[selectedDate] || []

  const hasExistingTimeEntries = useMemo(
    () => Object.values(zeitenMap).some((arr) => Array.isArray(arr) && arr.length > 0),
    [zeitenMap]
  )

  const handleAdd = async (
    entriesOrDates: Array<{ day: string; entry: unknown }> | string[] | string,
    entry?: unknown
  ) => {
    await onAdd(entriesOrDates, entry)
    setShowAddForm(false)
  }

  const handleEditSave = async (data: MultiDayEditData) => {
    await onEdit(data)
    setEditEntry(null)
  }

  const isFormOpen = showAddForm || !!editEntry

  return (
    <div className="space-y-4">
      {/* Tages-Auswahl */}
      {!isFormOpen && days.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {days.map((day) => (
            <button
              key={day}
              type="button"
              onClick={() => onDateChange(day)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                day === selectedDate
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              {format(new Date(day), 'EE dd.MM.', { locale: de })}
            </button>
          ))}
        </div>
      )}

      {isFormOpen ? (
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
          {editEntry ? (
            <EditTimeEntryForm
              project={project}
              selectedDate={selectedDate}
              entry={editEntry}
              employees={employees}
              onEdit={handleEditSave}
              onClose={() => setEditEntry(null)}
            />
          ) : (
            <TimeEntryForm
              project={project}
              selectedDate={selectedDate}
              employees={employees}
              hasExistingTimeEntries={hasExistingTimeEntries}
              onAdd={handleAdd}
              onClose={() => setShowAddForm(false)}
            />
          )}
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
              Zeiteinträge · {format(new Date(selectedDate), 'EEEE, dd.MM.yyyy', { locale: de })}
            </p>
            <Button size="sm" onClick={() => setShowAddForm(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Zeiteintrag hinzufügen
            </Button>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
            <table className="w-full text-xs">
              <thead className="bg-slate-100 dark:bg-slate-700">
                <tr>
                  {['Start', 'Ende', 'Name', 'Funktion', 'Std.', 'Extra', 'Fahrt', 'Bemerkung', ''].map((h) => (
                    <th key={h} className="px-2 py-1.5 text-left font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.length > 0 ? (
                  entries.map((e) => (
                    <tr key={e.id} className="border-t border-slate-100 dark:border-slate-700">
                      <td className="px-2 py-1.5 whitespace-nowrap">{formatTime(e.start)}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap">{formatTime(e.ende)}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap">{nameLabel(e)}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap uppercase">{funktionLabel(e)}</td>
                      <td className="px-2 py-1.5 text-right">{e.stunden || ''}</td>
                      <td className="px-2 py-1.5 text-right">{e.extra || ''}</td>
                      <td className="px-2 py-1.5 text-right">{e.fahrtstunden || ''}</td>
                      <td className="px-2 py-1.5 max-w-[10rem] truncate" title={e.bemerkung}>{e.bemerkung}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setEditEntry(e)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                            onClick={() => onDelete(selectedDate, e.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} className="px-2 py-4 text-center text-slate-400 dark:text-slate-500">
                      Keine Zeiteinträge für diesen Tag
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
