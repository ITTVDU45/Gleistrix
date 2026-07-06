'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import TechnikList from '@/components/TechnikList'
import TechnikAssignmentForm from '@/components/TechnikAssignmentForm'
import type { Project } from '../../../types'

interface MaterialTabProps {
  project: Project
  selectedDate: string
  onDateChange: (date: string) => void
  onAdd: (dateOrDates: string | string[], technik: { name: string; anzahl: number; meterlaenge: number; selectedDays?: string[] }) => Promise<void>
  onEdit: (date: string, technik: { id?: string; name: string; anzahl: number; meterlaenge: number; bemerkung?: string; selectedDays?: string[] }) => Promise<void>
  onRemove: (date: string, technikId: string) => Promise<void>
}

type EditTarget = { date: string; technik: Record<string, unknown> } | null

export default function MaterialTab({
  project,
  selectedDate,
  onDateChange,
  onAdd,
  onEdit,
  onRemove,
}: MaterialTabProps) {
  const [showAddForm, setShowAddForm] = useState(false)
  const [editTarget, setEditTarget] = useState<EditTarget>(null)

  const handleAssign = async (
    dateOrDates: string | string[],
    technik: { name: string; anzahl: number; meterlaenge: number; selectedDays?: string[] }
  ) => {
    if (editTarget) {
      await onEdit(editTarget.date, {
        id: (editTarget.technik.id as string) || undefined,
        name: technik.name,
        anzahl: technik.anzahl,
        meterlaenge: technik.meterlaenge,
        selectedDays: technik.selectedDays,
      })
      setEditTarget(null)
    } else {
      await onAdd(dateOrDates, technik)
      setShowAddForm(false)
    }
  }

  const isFormOpen = showAddForm || !!editTarget

  return (
    <div className="space-y-4">
      {!isFormOpen && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setShowAddForm(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Material / Technik hinzufügen
          </Button>
        </div>
      )}

      {isFormOpen ? (
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
          <TechnikAssignmentForm
            project={project}
            editMode={!!editTarget}
            initialValues={
              editTarget
                ? {
                    selectedTechnik: (editTarget.technik.name as string) || '',
                    anzahl: (editTarget.technik.anzahl as number) || 1,
                    meterlaenge: (editTarget.technik.meterlaenge as number) || 0,
                    selectedDays: [editTarget.date],
                  }
                : undefined
            }
            onAssign={handleAssign}
            onClose={() => {
              setShowAddForm(false)
              setEditTarget(null)
            }}
          />
        </div>
      ) : (
        <TechnikList
          project={project}
          selectedDate={selectedDate}
          onDateChange={onDateChange}
          onAdd={() => setShowAddForm(true)}
          onEdit={(date, technik) => setEditTarget({ date, technik: technik as Record<string, unknown> })}
          onRemove={onRemove}
        />
      )}
    </div>
  )
}
