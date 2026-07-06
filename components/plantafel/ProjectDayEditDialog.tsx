'use client'

import { useState, useCallback } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Loader2, ExternalLink, AlertTriangle } from 'lucide-react'
import { useEmployees } from '@/hooks/useEmployees'
import { useProjectEditing } from '@/hooks/useProjectEditing'
import StammdatenTab from './edit/StammdatenTab'
import ZeitenTab from './edit/ZeitenTab'
import MaterialTab from './edit/MaterialTab'
import FahrzeugeTab from './edit/FahrzeugeTab'
import type { PlantafelDayProject } from './types'

interface ProjectDayEditDialogProps {
  project: PlantafelDayProject | null
  dateKey: string
  open: boolean
  onClose: () => void
  onSaved: () => void
  onOpenDetail: (projectId: string) => void
}

export default function ProjectDayEditDialog({
  project,
  dateKey,
  open,
  onClose,
  onSaved,
  onOpenDetail,
}: ProjectDayEditDialogProps) {
  const projectId = project?.id || null
  const { employees } = useEmployees()
  const {
    project: fullProject,
    isLoading,
    error,
    changed,
    refetch,
    addTimeEntries,
    saveEditTimeEntry,
    deleteTimeEntry,
    addTechnik,
    editTechnik,
    removeTechnik,
    addVehicle,
    notifyVehicleChanged,
  } = useProjectEditing(projectId)

  const [selectedDate, setSelectedDate] = useState(dateKey)

  const handleClose = useCallback(() => {
    if (changed) onSaved()
    onClose()
  }, [changed, onSaved, onClose])

  const handleStammdatenSaved = useCallback(() => {
    refetch()
    onSaved()
  }, [refetch, onSaved])

  if (!project) return null

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[88vh] overflow-y-auto">
        <DialogTitle className="flex items-center justify-between gap-2 pr-6">
          <span className="truncate">{project.name}</span>
          <Button variant="outline" size="sm" onClick={() => onOpenDetail(project.id)} className="shrink-0">
            <ExternalLink className="h-4 w-4 mr-1" />
            Projektseite
          </Button>
        </DialogTitle>

        {isLoading || !fullProject ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-center space-y-3">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
              <p className="text-sm text-slate-500 dark:text-slate-400">Projekt wird geladen...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4">
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          </div>
        ) : (
          <Tabs defaultValue="zeiten" className="w-full">
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="stammdaten">Stammdaten</TabsTrigger>
              <TabsTrigger value="zeiten">Zeiten</TabsTrigger>
              <TabsTrigger value="material">Material</TabsTrigger>
              <TabsTrigger value="fahrzeuge">Fahrzeuge</TabsTrigger>
            </TabsList>

            <TabsContent value="stammdaten" className="mt-4">
              <StammdatenTab project={fullProject} onSaved={handleStammdatenSaved} />
            </TabsContent>

            <TabsContent value="zeiten" className="mt-4">
              <ZeitenTab
                project={fullProject}
                employees={employees}
                selectedDate={selectedDate}
                onDateChange={setSelectedDate}
                onAdd={addTimeEntries}
                onEdit={saveEditTimeEntry}
                onDelete={deleteTimeEntry}
              />
            </TabsContent>

            <TabsContent value="material" className="mt-4">
              <MaterialTab
                project={fullProject}
                selectedDate={selectedDate}
                onDateChange={setSelectedDate}
                onAdd={addTechnik}
                onEdit={editTechnik}
                onRemove={removeTechnik}
              />
            </TabsContent>

            <TabsContent value="fahrzeuge" className="mt-4">
              <FahrzeugeTab
                project={fullProject}
                selectedDate={selectedDate}
                onDateChange={setSelectedDate}
                onAdd={addVehicle}
                onChanged={notifyVehicleChanged}
              />
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  )
}
