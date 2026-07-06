'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Loader2, ExternalLink, AlertTriangle } from 'lucide-react'
import { useProjectEditing } from '@/hooks/useProjectEditing'
import SearchableSelect from './SearchableSelect'
import StammdatenTab from './edit/StammdatenTab'
import ZeitenTab from './edit/ZeitenTab'
import MaterialTab from './edit/MaterialTab'
import FahrzeugeTab from './edit/FahrzeugeTab'
import EinsatzTab from './edit/EinsatzTab'
import type {
  PlantafelEvent,
  CreatePlantafelAssignmentRequest,
  UpdatePlantafelAssignmentRequest,
} from './types'
import type { Employee, Project } from '../../types'

export type ProjectEditorTab = 'einsatz' | 'stammdaten' | 'zeiten' | 'material' | 'fahrzeuge'

interface ProjectEditorDialogProps {
  open: boolean
  projectId: string | null
  projectName?: string
  dateKey: string
  initialTab?: ProjectEditorTab
  einsatz?: PlantafelEvent | null
  einsatzDefaults?: { start?: Date; end?: Date; mitarbeiterId?: string }
  projects: Project[]
  employees: Employee[]
  events: PlantafelEvent[]
  onClose: () => void
  onSaved: () => void
  onOpenDetail: (projectId: string) => void
  onEinsatzCreate: (data: CreatePlantafelAssignmentRequest) => Promise<unknown>
  onEinsatzUpdate: (id: string, data: UpdatePlantafelAssignmentRequest) => Promise<unknown>
  onEinsatzDelete: (id: string) => Promise<unknown>
}

export default function ProjectDayEditDialog({
  open,
  projectId,
  projectName,
  dateKey,
  initialTab,
  einsatz,
  einsatzDefaults,
  projects,
  employees,
  events,
  onClose,
  onSaved,
  onOpenDetail,
  onEinsatzCreate,
  onEinsatzUpdate,
  onEinsatzDelete,
}: ProjectEditorDialogProps) {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(projectId)
  const [activeTab, setActiveTab] = useState<ProjectEditorTab>(initialTab ?? 'zeiten')
  const [einsatzChanged, setEinsatzChanged] = useState(false)

  useEffect(() => {
    setSelectedProjectId(projectId)
    setActiveTab(initialTab ?? 'zeiten')
    setEinsatzChanged(false)
  }, [projectId, initialTab, open])

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
  } = useProjectEditing(selectedProjectId)

  const [selectedDate, setSelectedDate] = useState(dateKey)
  useEffect(() => setSelectedDate(dateKey), [dateKey, open])

  const handleClose = useCallback(() => {
    if (changed || einsatzChanged) onSaved()
    onClose()
  }, [changed, einsatzChanged, onSaved, onClose])

  const handleStammdatenSaved = useCallback(() => {
    refetch()
    onSaved()
  }, [refetch, onSaved])

  // Einsatz-Callbacks: Änderungen merken, damit die Tafel beim Schließen aktualisiert
  const handleEinsatzCreate = useCallback(
    async (data: CreatePlantafelAssignmentRequest) => {
      const res = await onEinsatzCreate(data)
      setEinsatzChanged(true)
      return res
    },
    [onEinsatzCreate]
  )
  const handleEinsatzUpdate = useCallback(
    async (id: string, data: UpdatePlantafelAssignmentRequest) => {
      const res = await onEinsatzUpdate(id, data)
      setEinsatzChanged(true)
      return res
    },
    [onEinsatzUpdate]
  )
  const handleEinsatzDelete = useCallback(
    async (id: string) => {
      const res = await onEinsatzDelete(id)
      setEinsatzChanged(true)
      return res
    },
    [onEinsatzDelete]
  )

  const projectOptions = useMemo(
    () =>
      projects
        .filter((p) => p.status === 'aktiv' || p.id === selectedProjectId)
        .map((p) => ({ value: p.id, label: p.name })),
    [projects, selectedProjectId]
  )

  const title =
    fullProject?.name ||
    projectName ||
    (selectedProjectId ? 'Projekt' : 'Neuer Einsatz')

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[88vh] overflow-y-auto">
        <DialogTitle className="flex items-center justify-between gap-2 pr-6">
          <span className="truncate">{title}</span>
          {selectedProjectId && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenDetail(selectedProjectId)}
              className="shrink-0"
            >
              <ExternalLink className="h-4 w-4 mr-1" />
              Projektseite
            </Button>
          )}
        </DialogTitle>

        {/* Projekt-Auswahl im Create-Modus (kein Projektkontext) */}
        {!selectedProjectId ? (
          <div className="space-y-3 py-2">
            <Label>Projekt auswählen *</Label>
            <SearchableSelect
              value={selectedProjectId || ''}
              onValueChange={(v) => setSelectedProjectId(v)}
              options={projectOptions}
              placeholder="Projekt auswählen"
              emptyLabel="Kein Projekt gefunden"
              searchPlaceholder="Projekt suchen..."
            />
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Nach der Auswahl können Einsätze geplant sowie Zeiten, Material und Fahrzeuge gepflegt werden.
            </p>
          </div>
        ) : isLoading || !fullProject ? (
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
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ProjectEditorTab)} className="w-full">
            <TabsList className="grid grid-cols-5 w-full">
              <TabsTrigger value="einsatz">Einsatz</TabsTrigger>
              <TabsTrigger value="stammdaten">Stammdaten</TabsTrigger>
              <TabsTrigger value="zeiten">Zeiten</TabsTrigger>
              <TabsTrigger value="material">Material</TabsTrigger>
              <TabsTrigger value="fahrzeuge">Fahrzeuge</TabsTrigger>
            </TabsList>

            <TabsContent value="einsatz" className="mt-4">
              <EinsatzTab
                projektId={selectedProjectId}
                einsatz={einsatz}
                defaults={einsatzDefaults}
                employees={employees}
                events={events}
                onCreate={handleEinsatzCreate}
                onUpdate={handleEinsatzUpdate}
                onDelete={handleEinsatzDelete}
              />
            </TabsContent>

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
