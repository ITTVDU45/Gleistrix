/**
 * Hauptberechnung für Zeiteinträge - Segment-Analyse und Zuschlagsberechnung
 * @module lib/timeEntry/computeTimeEntry
 * 
 * Berechnet für jeden Minute-Segment:
 * - Nachtzeit (23:00-06:00)
 * - Sonntag (ganztägig)
 * - Feiertag (ganztägig, basierend auf Holiday-Liste)
 * - Pause (basierend auf Pausensegmenten)
 * 
 * ADDITIV: Jeder Zuschlag wird unabhängig gezählt.
 * Eine Minute kann mehrere Zuschläge haben (z.B. Nacht + Sonntag).
 * Pausen werden aus ALLEN zutreffenden Kategorien abgezogen.
 */

import { addMinutes } from 'date-fns'
import type { BreakSegment, ComputedPremiums, ComputedTimeEntry } from './types'
import {
  calculateRequiredBreakMinutes,
  calculateBreakSegments,
  calculateBreakTotalMinutes,
  isInBreak,
  isNightTime,
  isSundayTime,
  isHolidayDate
} from './calculateBreaks'

/**
 * Parameter für die Zeiteintrag-Berechnung
 */
export interface ComputeTimeEntryParams {
  startISO: string
  endISO: string
  holidays: string[]           // Liste der Feiertage im Format YYYY-MM-DD
  manualBreaks?: BreakSegment[] // Optional: Manuell definierte Pausen
  overrideBreaks?: boolean      // true wenn manuelle Pausen verwendet werden sollen
}

/**
 * Analysiert den Zeitraum Minute für Minute und kategorisiert jede Minute
 * 
 * ADDITIV: Jeder Zuschlag wird unabhängig gezählt.
 * Eine Arbeitsminute kann mehrere Zuschläge gleichzeitig haben.
 * 
 * @param startISO - Startzeit als ISO-String
 * @param endISO - Endzeit als ISO-String
 * @param breakSegments - Array von Pausensegmenten
 * @param holidays - Array von Feiertagen im Format YYYY-MM-DD
 * @returns Berechnete Zuschläge
 */
export function analyzeTimeSegments(
  startISO: string,
  endISO: string,
  breakSegments: BreakSegment[],
  holidays: string[]
): ComputedPremiums {
  const startDate = new Date(startISO)
  const endDate = new Date(endISO)
  
  let normalMinutes = 0
  let nightMinutes = 0
  let sundayMinutes = 0
  let holidayMinutes = 0
  let nightHolidayMinutes = 0
  let sundayHolidayMinutes = 0
  let breakTotalMinutes = 0
  let totalWorkMinutes = 0

  let current = new Date(startDate)
  
  while (current < endDate) {
    const inBreak = isInBreak(current, breakSegments)
    const isNight = isNightTime(current)
    const isSunday = isSundayTime(current)
    const isHoliday = isHolidayDate(current, holidays)

    if (inBreak) {
      // Pausenminute - zählt nicht als Arbeitszeit
      breakTotalMinutes++
    } else {
      // Arbeitsminute - ADDITIV kategorisieren
      totalWorkMinutes++

      // Prüfe ob irgendein Zuschlag zutrifft
      const hasAnyPremium = isNight || isSunday || isHoliday

      if (!hasAnyPremium) {
        // Keine Zuschläge - normale Arbeitszeit
        normalMinutes++
      } else {
        // ADDITIV: Jeder Zuschlag wird separat gezählt
        
        // Nachtzuschlag (23:00-06:00)
        if (isNight) {
          nightMinutes++
        }
        
        // Sonntagszuschlag (ganzer Sonntag)
        if (isSunday) {
          sundayMinutes++
        }
        
        // Feiertagszuschlag (ganze Feiertage)
        if (isHoliday) {
          holidayMinutes++
        }
        
        // Kombinationen für zusätzliche Auswertung
        if (isNight && isHoliday) {
          nightHolidayMinutes++
        }
        if (isSunday && isHoliday) {
          sundayHolidayMinutes++
        }
      }
    }

    current = addMinutes(current, 1)
  }

  return {
    normalMinutes,
    nightMinutes,
    sundayMinutes,
    holidayMinutes,
    nightHolidayMinutes,
    sundayHolidayMinutes,
    totalWorkMinutes,
    breakTotalMinutes
  }
}

/**
 * Berechnet einen vollständigen Zeiteintrag mit automatischer Pausenberechnung
 * und Zuschlagsermittlung
 * 
 * @param params - Berechnungsparameter
 * @returns Berechneter Zeiteintrag
 */
export function computeTimeEntry(params: ComputeTimeEntryParams): ComputedTimeEntry {
  const { startISO, endISO, holidays, manualBreaks, overrideBreaks = false } = params

  const startDate = new Date(startISO)
  const endDate = new Date(endISO)
  
  // Gesamtdauer in Minuten (inkl. Pausen)
  const totalDurationMinutes = (endDate.getTime() - startDate.getTime()) / (1000 * 60)

  // Pausensegmente bestimmen
  let breakSegments: BreakSegment[]
  
  if (overrideBreaks && manualBreaks) {
    // Manuelle Pausen verwenden
    breakSegments = manualBreaks
  } else {
    // Automatische Pausenberechnung
    // Erst ohne Pausen berechnen, um die Arbeitszeit zu ermitteln
    const requiredBreakMinutes = calculateRequiredBreakMinutes(totalDurationMinutes)
    breakSegments = calculateBreakSegments(startISO, endISO, requiredBreakMinutes)
  }

  const breakTotalMinutes = calculateBreakTotalMinutes(breakSegments)
  
  // Bezahlte Arbeitszeit (ohne Pausen)
  const paidDurationMinutes = totalDurationMinutes - breakTotalMinutes

  // Segment-Analyse für Zuschläge
  const premiums = analyzeTimeSegments(startISO, endISO, breakSegments, holidays)

  return {
    startISO,
    endISO,
    totalDurationMinutes,
    paidDurationMinutes,
    breakSegments,
    breakTotalMinutes,
    premiums,
    overrideBreaks
  }
}

/**
 * Konvertiert Minuten in Stunden mit 2 Dezimalstellen
 * @param minutes - Minuten
 * @returns Stunden als Dezimalzahl
 */
export function minutesToHours(minutes: number): number {
  return Math.round((minutes / 60) * 100) / 100
}

/**
 * Formatiert Minuten als Stunden:Minuten String
 * @param minutes - Minuten
 * @returns Formatierter String (z.B. "7:30")
 */
export function formatMinutesAsTime(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours}:${mins.toString().padStart(2, '0')}`
}
