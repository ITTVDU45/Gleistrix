'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { format } from 'date-fns'
import { PlantafelApi } from '@/lib/api/plantafel'
import ProjectDayCard from './ProjectDayCard'
import NewProjectCard from './NewProjectCard'
import ProjectDayEditDialog from './ProjectDayEditDialog'
import type { PlantafelDayProject, PlantafelEvent } from './types'

interface DayViewProps {
  date: Date
  events: PlantafelEvent[]
  onCreateProject: () => void
  onProjectSaved: () => void
  onOpenDetail: (projectId: string) => void
  refreshKey: number
}

export default function DayView({
  date,
  events,
  onCreateProject,
  onProjectSaved,
  onOpenDetail,
  refreshKey,
}: DayViewProps) {
  const [projects, setProjects] = useState<PlantafelDayProject[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [internalRefresh, setInternalRefresh] = useState(0)
  const [editProject, setEditProject] = useState<PlantafelDayProject | null>(null)
  const [isEditOpen, setIsEditOpen] = useState(false)

  const dateKey = format(date, 'yyyy-MM-dd')

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const res = await PlantafelApi.getDayProjects(dateKey)
        if (!cancelled) {
          setProjects(res.data?.projects || [])
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Tagesdaten konnten nicht geladen werden')
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [dateKey, refreshKey, internalRefresh])

  const handleCardClick = useCallback((project: PlantafelDayProject) => {
    setEditProject(project)
    setIsEditOpen(true)
  }, [])

  const handleDialogSaved = useCallback(() => {
    setInternalRefresh((k) => k + 1)
    onProjectSaved()
  }, [onProjectSaved])

  const einsatzEventsByProject = useMemo(() => {
    const map = new Map<string, PlantafelEvent[]>()
    for (const e of events) {
      if (e.sourceType !== 'einsatz' || !e.projektId) continue
      const list = map.get(e.projektId) || []
      list.push(e)
      map.set(e.projektId, list)
    }
    return map
  }, [events])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto" />
          <p className="text-sm text-slate-500 dark:text-slate-400">Tagesansicht wird geladen...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-6">
        <p className="text-red-700 dark:text-red-400 font-medium">Fehler beim Laden der Tagesansicht</p>
        <p className="text-sm text-red-600 dark:text-red-500 mt-1">{error}</p>
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {projects.map((project) => (
          <ProjectDayCard
            key={project.id}
            project={project}
            einsatzEvents={einsatzEventsByProject.get(project.id) || []}
            onClick={() => handleCardClick(project)}
          />
        ))}
        <NewProjectCard onClick={onCreateProject} />
      </div>

      {isEditOpen && editProject && (
        <ProjectDayEditDialog
          project={editProject}
          dateKey={dateKey}
          open={isEditOpen}
          onClose={() => setIsEditOpen(false)}
          onSaved={handleDialogSaved}
          onOpenDetail={onOpenDetail}
        />
      )}
    </>
  )
}
