'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import VehicleAssignmentList from '@/components/VehicleAssignmentList'
import { VehicleAssignmentForm } from '@/components/VehicleAssignmentForm'
import { useVehicles } from '@/hooks/useVehicles'
import type { Project, Vehicle } from '../../../types'

interface FahrzeugeTabProps {
  project: Project
  selectedDate: string
  onDateChange: (date: string) => void
  onAdd: (dates: string[], vehicle: Vehicle) => Promise<void>
  onChanged: () => void
}

export default function FahrzeugeTab({
  project,
  selectedDate,
  onDateChange,
  onAdd,
  onChanged,
}: FahrzeugeTabProps) {
  const { vehicles } = useVehicles()
  const [showAddForm, setShowAddForm] = useState(false)

  const handleAssigned = async (dates: string[], vehicle: Vehicle) => {
    await onAdd(dates, vehicle)
    setShowAddForm(false)
  }

  return (
    <div className="space-y-4">
      {!showAddForm && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setShowAddForm(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Fahrzeug zuweisen
          </Button>
        </div>
      )}

      {showAddForm ? (
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
          <VehicleAssignmentForm
            project={project}
            vehicles={vehicles}
            onVehicleAssigned={handleAssigned}
            onClose={() => setShowAddForm(false)}
          />
        </div>
      ) : (
        <VehicleAssignmentList
          project={project}
          vehicles={vehicles}
          selectedDate={selectedDate}
          onDateChange={onDateChange}
          onEdit={() => onChanged()}
        />
      )}
    </div>
  )
}
