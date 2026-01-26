/**
 * Zeiteintrag-Berechnungs-API
 * POST: Berechnet Pausen und Zuschläge für einen Zeiteintrag
 * 
 * Verwendet die zentrale Berechnungslogik und lädt Feiertage aus der DB
 */

import { NextResponse } from 'next/server'
import dbConnect from '@/lib/dbConnect'
import { Holiday } from '@/lib/models/Holiday'
import { computeTimeEntry, minutesToHours } from '@/lib/timeEntry'
import type { BreakSegment } from '@/lib/timeEntry'

interface CalculateRequest {
  startISO: string
  endISO: string
  breakSegments?: BreakSegment[]
  overrideBreaks?: boolean
  bundesland?: string
}

// POST: Zeiteintrag berechnen
export async function POST(request: Request) {
  try {
    await dbConnect()

    const body: CalculateRequest = await request.json()
    const { startISO, endISO, breakSegments, overrideBreaks = false, bundesland } = body

    // Validierung
    if (!startISO || !endISO) {
      return NextResponse.json(
        { success: false, error: 'startISO und endISO sind erforderlich' },
        { status: 400 }
      )
    }

    // Datum-Validierung
    const startDate = new Date(startISO)
    const endDate = new Date(endISO)

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json(
        { success: false, error: 'Ungültiges Datumsformat' },
        { status: 400 }
      )
    }

    if (startDate >= endDate) {
      return NextResponse.json(
        { success: false, error: 'Endzeit muss nach Startzeit liegen' },
        { status: 400 }
      )
    }

    // Feiertage für den Zeitraum aus DB laden
    const startDateStr = startISO.slice(0, 10)
    const endDateStr = endISO.slice(0, 10)

    // Filter für Feiertage: bundesweit oder spezifisches Bundesland
    const holidayFilter: Record<string, any> = {
      date: { $gte: startDateStr, $lte: endDateStr }
    }
    
    if (bundesland) {
      holidayFilter.$or = [
        { bundesland: bundesland },
        { bundesland: 'ALL' }
      ]
    }

    const holidayDocs = await Holiday.find(holidayFilter).lean()
    const holidays = holidayDocs.map((h: any) => h.date)

    // Berechnung durchführen
    const result = computeTimeEntry({
      startISO,
      endISO,
      holidays,
      manualBreaks: breakSegments,
      overrideBreaks
    })

    // Response aufbereiten
    return NextResponse.json({
      success: true,
      calculation: {
        startISO: result.startISO,
        endISO: result.endISO,
        totalDurationMinutes: result.totalDurationMinutes,
        totalDurationHours: minutesToHours(result.totalDurationMinutes),
        paidDurationMinutes: result.paidDurationMinutes,
        paidDurationHours: minutesToHours(result.paidDurationMinutes),
        breakSegments: result.breakSegments,
        breakTotalMinutes: result.breakTotalMinutes,
        overrideBreaks: result.overrideBreaks,
        premiums: {
          nightMinutes: result.premiums.nightMinutes,
          nightHours: minutesToHours(result.premiums.nightMinutes),
          sundayMinutes: result.premiums.sundayMinutes,
          sundayHours: minutesToHours(result.premiums.sundayMinutes),
          holidayMinutes: result.premiums.holidayMinutes,
          holidayHours: minutesToHours(result.premiums.holidayMinutes),
          nightHolidayMinutes: result.premiums.nightHolidayMinutes,
          nightHolidayHours: minutesToHours(result.premiums.nightHolidayMinutes),
          sundayHolidayMinutes: result.premiums.sundayHolidayMinutes,
          sundayHolidayHours: minutesToHours(result.premiums.sundayHolidayMinutes),
          normalMinutes: result.premiums.normalMinutes,
          normalHours: minutesToHours(result.premiums.normalMinutes),
          totalWorkMinutes: result.premiums.totalWorkMinutes,
          totalWorkHours: minutesToHours(result.premiums.totalWorkMinutes)
        },
        holidays: holidays // Zurückgeben, welche Feiertage im Zeitraum gefunden wurden
      }
    })
  } catch (error) {
    console.error('Fehler bei der Zeiteintrag-Berechnung:', error)
    return NextResponse.json(
      { success: false, error: 'Fehler bei der Berechnung' },
      { status: 500 }
    )
  }
}
