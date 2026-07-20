/**
 * Feiertags-API Client
 * Funktionen für die Kommunikation mit der Feiertags-API
 */

import type { BreakSegment } from '@/types/main'

export interface Holiday {
  id: string
  date: string
  name: string
  bundesland: string
  createdAt?: string
  updatedAt?: string
}

export interface HolidayListResponse {
  success: boolean
  holidays: Holiday[]
  error?: string
}

export interface HolidayResponse {
  success: boolean
  holiday: Holiday
  error?: string
}

export interface CalculationResult {
  startISO: string
  endISO: string
  totalDurationMinutes: number
  totalDurationHours: number
  paidDurationMinutes: number
  paidDurationHours: number
  breakSegments: BreakSegment[]
  breakTotalMinutes: number
  overrideBreaks: boolean
  premiums: {
    nightMinutes: number
    nightHours: number
    sundayMinutes: number
    sundayHours: number
    holidayMinutes: number
    holidayHours: number
    nightHolidayMinutes: number
    nightHolidayHours: number
    sundayHolidayMinutes: number
    sundayHolidayHours: number
    normalMinutes: number
    normalHours: number
    totalWorkMinutes: number
    totalWorkHours: number
  }
  holidays: string[]
}

export interface CalculateResponse {
  success: boolean
  calculation: CalculationResult
  error?: string
}

/**
 * Feiertags-API Client
 */
export const HolidaysApi = {
  /**
   * Alle Feiertage abrufen
   */
  list: async (params?: {
    year?: string
    bundesland?: string
    startDate?: string
    endDate?: string
  }): Promise<HolidayListResponse> => {
    const searchParams = new URLSearchParams()
    if (params?.year) searchParams.set('year', params.year)
    if (params?.bundesland) searchParams.set('bundesland', params.bundesland)
    if (params?.startDate) searchParams.set('startDate', params.startDate)
    if (params?.endDate) searchParams.set('endDate', params.endDate)

    const url = `/api/holidays${searchParams.toString() ? '?' + searchParams.toString() : ''}`
    const res = await fetch(url, { credentials: 'include' })
    return res.json()
  },

  /**
   * Einzelnen Feiertag abrufen
   */
  get: async (id: string): Promise<HolidayResponse> => {
    const res = await fetch(`/api/holidays/${id}`, { credentials: 'include' })
    return res.json()
  },

  /**
   * Neuen Feiertag erstellen
   */
  create: async (data: {
    date: string
    name: string
    bundesland?: string
  }): Promise<HolidayResponse> => {
    const res = await fetch('/api/holidays', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data)
    })
    return res.json()
  },

  /**
   * Feiertag aktualisieren
   */
  update: async (id: string, data: {
    date: string
    name: string
    bundesland?: string
  }): Promise<HolidayResponse> => {
    const res = await fetch(`/api/holidays/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data)
    })
    return res.json()
  },

  /**
   * Feiertag löschen
   */
  delete: async (id: string): Promise<{ success: boolean; error?: string }> => {
    const res = await fetch(`/api/holidays/${id}`, {
      method: 'DELETE',
      credentials: 'include'
    })
    return res.json()
  }
}

/**
 * Zeiteintrag-Berechnungs-API Client
 */
export const TimeEntryCalculationApi = {
  /**
   * Berechnet Pausen und Zuschläge für einen Zeiteintrag
   */
  calculate: async (params: {
    startISO: string
    endISO: string
    breakSegments?: BreakSegment[]
    overrideBreaks?: boolean
    bundesland?: string
  }): Promise<CalculateResponse> => {
    const res = await fetch('/api/time-entries/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(params)
    })
    return res.json()
  }
}

export default HolidaysApi
