'use client'

import { useState, useEffect, useCallback } from 'react'
import { PlantafelApi } from '@/lib/api/plantafel'
import type {
  PlantafelEvent,
  PlantafelResource,
  PlantafelView,
  PlantafelCalendarView,
  PlantafelFilters,
  PlantafelDateRange,
  ConflictInfo,
  CreatePlantafelAssignmentRequest,
  UpdatePlantafelAssignmentRequest,
} from '@/components/plantafel/types'
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfDay, endOfDay, format } from 'date-fns'

function getDateRangeForView(date: Date, calendarView: PlantafelCalendarView): PlantafelDateRange {
  switch (calendarView) {
    case 'day':
      return { start: startOfDay(date), end: endOfDay(date) }
    case 'week':
      return { start: startOfWeek(date, { weekStartsOn: 1 }), end: endOfWeek(date, { weekStartsOn: 1 }) }
    case 'month':
      return { start: startOfMonth(date), end: endOfMonth(date) }
    case 'year': {
      const yearStart = new Date(date.getFullYear(), 0, 1)
      const yearEnd = new Date(date.getFullYear(), 11, 31, 23, 59, 59)
      return { start: yearStart, end: yearEnd }
    }
  }
}

const DEFAULT_FILTERS: PlantafelFilters = {
  employeeIds: [],
  projectIds: [],
  showAbsences: true,
  showGermanHolidays: true,
  showIslamicHolidays: false,
  hiddenProjectStatuses: [],
  eventTypes: [],
}

export function usePlantafel() {
  const [view, setView] = useState<PlantafelView>('team')
  const [calendarView, setCalendarView] = useState<PlantafelCalendarView>('week')
  const [currentDate, setCurrentDate] = useState<Date>(new Date())
  const [filters, setFilters] = useState<PlantafelFilters>(DEFAULT_FILTERS)

  const [events, setEvents] = useState<PlantafelEvent[]>([])
  const [resources, setResources] = useState<PlantafelResource[]>([])
  const [conflicts, setConflicts] = useState<ConflictInfo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const dateRange = getDateRangeForView(currentDate, calendarView)

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const range = getDateRangeForView(currentDate, calendarView)
      const result = await PlantafelApi.getAssignments({
        from: format(range.start, 'yyyy-MM-dd'),
        to: format(range.end, 'yyyy-MM-dd'),
        view,
        employeeIds: filters.employeeIds.length > 0 ? filters.employeeIds : undefined,
        projectIds: filters.projectIds.length > 0 ? filters.projectIds : undefined,
        showAbsences: filters.showAbsences,
        showGermanHolidays: filters.showGermanHolidays,
        showIslamicHolidays: filters.showIslamicHolidays,
        hiddenProjectStatuses: filters.hiddenProjectStatuses,
      })

      if (result.success && result.data) {
        const parsedEvents = result.data.events.map((e) => ({
          ...e,
          start: new Date(e.start),
          end: new Date(e.end),
        }))
        setEvents(parsedEvents)
        setResources(result.data.resources)
        setConflicts(result.data.conflicts)
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Fehler beim Laden der Plantafel-Daten'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [currentDate, calendarView, view, filters])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const createAssignment = useCallback(async (data: CreatePlantafelAssignmentRequest) => {
    const result = await PlantafelApi.createAssignment(data)
    if (result.success) await fetchData()
    return result
  }, [fetchData])

  const updateAssignment = useCallback(async (id: string, data: UpdatePlantafelAssignmentRequest) => {
    const result = await PlantafelApi.updateAssignment(id, data)
    if (result.success) await fetchData()
    return result
  }, [fetchData])

  const deleteAssignment = useCallback(async (id: string) => {
    const result = await PlantafelApi.deleteAssignment(id)
    if (result.success) await fetchData()
    return result
  }, [fetchData])

  return {
    view,
    setView,
    calendarView,
    setCalendarView,
    currentDate,
    setCurrentDate,
    dateRange,
    filters,
    setFilters,

    events,
    resources,
    conflicts,
    isLoading,
    error,

    fetchData,
    createAssignment,
    updateAssignment,
    deleteAssignment,
  }
}
