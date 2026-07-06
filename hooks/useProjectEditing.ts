'use client'

import { useState, useCallback, useEffect } from 'react'
import { ProjectsApi } from '@/lib/api/projects'
import type { Project } from '../types'

interface MultiDayEditData {
  updates: Array<{ day: string; entryId: string; entry: unknown }>
  newEntries: Array<{ day: string; entry: unknown }>
}

interface TechnikPayload {
  name: string
  anzahl: number
  meterlaenge: number
  bemerkung?: string
  selectedDays?: string[]
}

function normalizeProject(p: unknown): Project | null {
  if (!p || typeof p !== 'object') return null
  const obj = p as Record<string, unknown>
  const pid =
    typeof obj.id === 'string' && obj.id
      ? obj.id
      : typeof obj._id === 'string'
      ? obj._id
      : String(obj._id || '')
  return (pid ? { ...(obj as object), id: pid } : obj) as unknown as Project
}

/**
 * Kapselt das Vollprojekt (mit mitarbeiterZeiten/technik/fahrzeuge) und alle
 * Mutations-Handler für den Plantafel-Editor. Nutzt exakt dieselben API-Payloads
 * wie die Projektdetailseite (inkl. automatischem ActivityLog & Mitarbeiter-Sync).
 */
export function useProjectEditing(projectId: string | null) {
  const [project, setProject] = useState<Project | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [changed, setChanged] = useState(false)

  const refetch = useCallback(async () => {
    if (!projectId) return
    try {
      const res = await ProjectsApi.get(projectId)
      const raw = res && (res as Record<string, unknown>).project
        ? (res as Record<string, unknown>).project
        : res
      const normalized = normalizeProject(raw)
      if (normalized) setProject(normalized)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Projekt konnte nicht geladen werden')
    }
  }, [projectId])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!projectId) return
      setIsLoading(true)
      setError(null)
      try {
        const res = await ProjectsApi.get(projectId)
        const raw = res && (res as Record<string, unknown>).project
          ? (res as Record<string, unknown>).project
          : res
        const normalized = normalizeProject(raw)
        if (!cancelled && normalized) setProject(normalized)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Projekt konnte nicht geladen werden')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [projectId])

  const markChanged = useCallback(() => setChanged(true), [])

  // -------- Zeiten --------
  const addTimeEntries = useCallback(
    async (entriesOrDates: Array<{ day: string; entry: unknown }> | string[] | string, entry?: unknown) => {
      if (!projectId) return
      const isNewFormat =
        Array.isArray(entriesOrDates) &&
        entriesOrDates.length > 0 &&
        typeof entriesOrDates[0] === 'object' &&
        entriesOrDates[0] !== null &&
        'day' in (entriesOrDates[0] as object)

      if (isNewFormat) {
        await ProjectsApi.update(projectId, { times: { action: 'add', entries: entriesOrDates } } as never)
      } else {
        const dates = Array.isArray(entriesOrDates) ? entriesOrDates : [entriesOrDates]
        await ProjectsApi.update(projectId, { times: { action: 'add', dates, entry } } as never)
      }
      markChanged()
      await refetch()
    },
    [projectId, markChanged, refetch]
  )

  const saveEditTimeEntry = useCallback(
    async (data: MultiDayEditData) => {
      if (!projectId) return
      for (const { day, entry } of data.updates) {
        await ProjectsApi.update(projectId, { times: { action: 'edit', date: day, updatedEntry: entry } } as never)
      }
      if (data.newEntries.length > 0) {
        await ProjectsApi.update(projectId, { times: { action: 'add', entries: data.newEntries } } as never)
      }
      markChanged()
      await refetch()
    },
    [projectId, markChanged, refetch]
  )

  const deleteTimeEntry = useCallback(
    async (date: string, entryId: string) => {
      if (!projectId) return
      await ProjectsApi.update(projectId, { times: { action: 'delete', date, entryId } } as never)
      markChanged()
      await refetch()
    },
    [projectId, markChanged, refetch]
  )

  // -------- Technik / Material --------
  const addTechnik = useCallback(
    async (dateOrDates: string | string[], technik: TechnikPayload) => {
      if (!projectId) return
      const payload = Array.isArray(dateOrDates)
        ? { technik: { action: 'add', dates: dateOrDates, technik } }
        : { technik: { action: 'add', date: dateOrDates, technik } }
      await ProjectsApi.update(projectId, payload as never)
      markChanged()
      await refetch()
    },
    [projectId, markChanged, refetch]
  )

  const editTechnik = useCallback(
    async (date: string, technik: TechnikPayload & { id?: string }) => {
      if (!projectId) return
      const requestBody: Record<string, unknown> = {
        action: 'edit',
        date,
        technikId: technik.id,
        updatedTechnik: {
          name: technik.name,
          anzahl: technik.anzahl,
          meterlaenge: technik.meterlaenge,
          bemerkung: technik.bemerkung || '',
        },
      }
      if (technik.selectedDays && Array.isArray(technik.selectedDays)) {
        requestBody.selectedDays = technik.selectedDays
      }
      await ProjectsApi.update(projectId, { technik: requestBody } as never)
      markChanged()
      await refetch()
    },
    [projectId, markChanged, refetch]
  )

  const removeTechnik = useCallback(
    async (date: string, technikId: string) => {
      if (!projectId) return
      await ProjectsApi.update(projectId, { technik: { action: 'remove', date, technikId } } as never)
      markChanged()
      await refetch()
    },
    [projectId, markChanged, refetch]
  )

  // -------- Fahrzeuge --------
  const addVehicle = useCallback(
    async (dateOrDates: string | string[], vehicle: unknown) => {
      if (!projectId) return
      const dates = Array.isArray(dateOrDates) ? dateOrDates : [dateOrDates]
      await ProjectsApi.update(projectId, { vehicles: { action: 'assign', dates, vehicle } } as never)
      markChanged()
      await refetch()
    },
    [projectId, markChanged, refetch]
  )

  const notifyVehicleChanged = useCallback(async () => {
    markChanged()
    await refetch()
  }, [markChanged, refetch])

  return {
    project,
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
  }
}
