import { logger } from '@/lib/logger'
/**
 * Feiertags-API - CRUD Operationen für Feiertage
 * GET: Liste aller Feiertage (optional gefiltert nach Jahr, Bundesland, Datumsbereich)
 * POST: Neuen betrieblichen Feiertag erstellen
 *
 * Gesetzliche Feiertage (bundesweit und regional, alle 16 Bundesländer) werden
 * berechnet und nicht in der Datenbank gepflegt. Die Datenbank enthält nur
 * zusätzliche betriebliche Feiertage.
 */

import { NextResponse } from 'next/server'
import dbConnect from '@/lib/dbConnect'
import { Holiday } from '@/lib/models/Holiday'
import { getCurrentUser } from '@/lib/auth/getCurrentUser'
import {
  formatHolidayScope,
  getGermanHolidaysInRange,
  isGermanStateCode,
  type GermanStateCode,
} from '@/lib/holidays'

/**
 * Ohne Zeitraum-Angabe wird ein Fenster um das aktuelle Jahr berechnet – die
 * gesetzlichen Feiertage sind eine unendliche Reihe und brauchen eine Grenze.
 */
const DEFAULT_YEAR_SPAN = 5

interface HolidayResponseItem {
  id: string
  date: string
  name: string
  bundesland: string
  /** `gesetzlich` = berechnet und nicht editierbar, `betrieblich` = aus der DB. */
  source: 'gesetzlich' | 'betrieblich'
  nationwide: boolean
  states: string[]
  partialStates: string[]
  scope: string
  note?: string
  createdAt?: Date
  updatedAt?: Date
}

function resolveRange(params: URLSearchParams): { startDate: string; endDate: string } {
  const year = params.get('year')
  const startDate = params.get('startDate')
  const endDate = params.get('endDate')

  if (year && /^\d{4}$/.test(year)) {
    return { startDate: `${year}-01-01`, endDate: `${year}-12-31` }
  }

  const currentYear = new Date().getFullYear()
  return {
    startDate: startDate || `${currentYear - DEFAULT_YEAR_SPAN}-01-01`,
    endDate: endDate || `${currentYear + DEFAULT_YEAR_SPAN}-12-31`,
  }
}

// GET: Liste aller Feiertage (gesetzlich berechnet + betrieblich aus der DB)
export async function GET(request: Request) {
  try {
    await dbConnect()

    const { searchParams } = new URL(request.url)
    const { startDate, endDate } = resolveRange(searchParams)

    const bundeslandParam = searchParams.get('bundesland')
    const states: GermanStateCode[] = isGermanStateCode(bundeslandParam) ? [bundeslandParam] : []

    const statutory: HolidayResponseItem[] = getGermanHolidaysInRange(startDate, endDate, {
      states,
    }).map((h) => ({
      id: h.id,
      date: h.dateKey,
      bundesland: h.nationwide ? 'ALL' : [...h.states, ...h.partialStates].join(','),
      name: h.name,
      source: 'gesetzlich' as const,
      nationwide: h.nationwide,
      states: h.states,
      partialStates: h.partialStates,
      scope: formatHolidayScope(h),
      note: h.note,
    }))

    // Betriebliche Zusatztage aus der DB; Bundesweit (ALL) gilt immer mit.
    const dbFilter: Record<string, unknown> = { date: { $gte: startDate, $lte: endDate } }
    if (states.length > 0) {
      dbFilter.$or = [{ bundesland: states[0] }, { bundesland: 'ALL' }]
    }

    const custom = await Holiday.find(dbFilter).lean()
    const statutoryByDate = new Map<string, HolidayResponseItem[]>()
    for (const item of statutory) {
      const list = statutoryByDate.get(item.date)
      if (list) list.push(item)
      else statutoryByDate.set(item.date, [item])
    }

    const customItems: HolidayResponseItem[] = custom
      // Altbestand, der einen gesetzlichen Feiertag doppelt abbildet, wird
      // unterdrückt – der berechnete Eintrag ist maßgeblich.
      .filter((h) => !isDuplicateOfStatutory(String(h.date), h.bundesland, statutoryByDate))
      .map((h) => ({
        id: h._id.toString(),
        date: String(h.date),
        name: h.name,
        bundesland: h.bundesland,
        source: 'betrieblich' as const,
        nationwide: h.bundesland === 'ALL',
        states: h.bundesland === 'ALL' ? [] : [h.bundesland],
        partialStates: [],
        scope: h.bundesland === 'ALL' ? 'betrieblich, bundesweit' : `betrieblich, ${h.bundesland}`,
        createdAt: h.createdAt,
        updatedAt: h.updatedAt,
      }))

    const holidays = [...statutory, ...customItems].sort((a, b) =>
      a.date < b.date ? -1 : a.date > b.date ? 1 : a.name.localeCompare(b.name)
    )

    return NextResponse.json({ success: true, holidays })
  } catch (error) {
    logger.error('Fehler beim Laden der Feiertage:', error)
    return NextResponse.json(
      { success: false, error: 'Fehler beim Laden der Feiertage' },
      { status: 500 }
    )
  }
}

function isDuplicateOfStatutory(
  date: string,
  bundesland: string,
  statutoryByDate: ReadonlyMap<string, HolidayResponseItem[]>
): boolean {
  const sameDay = statutoryByDate.get(date)
  if (!sameDay || sameDay.length === 0) return false
  if (bundesland === 'ALL') return sameDay.some((h) => h.nationwide)
  return sameDay.some(
    (h) => h.nationwide || h.states.includes(bundesland) || h.partialStates.includes(bundesland)
  )
}

// POST: Neuen Feiertag erstellen
export async function POST(request: Request) {
  try {
    const currentUser = await getCurrentUser(request as any)
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: 'Nicht autorisiert' },
        { status: 401 }
      )
    }

    // Nur Admins dürfen Feiertage erstellen
    if ((currentUser as any).role !== 'admin' && (currentUser as any).role !== 'superadmin') {
      return NextResponse.json(
        { success: false, error: 'Keine Berechtigung' },
        { status: 403 }
      )
    }

    await dbConnect()

    const body = await request.json()
    const { date, name, bundesland = 'ALL' } = body

    // Validierung
    if (!date || !name) {
      return NextResponse.json(
        { success: false, error: 'Datum und Name sind erforderlich' },
        { status: 400 }
      )
    }

    // Datumsformat prüfen (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { success: false, error: 'Ungültiges Datumsformat. Erwarte YYYY-MM-DD' },
        { status: 400 }
      )
    }

    // Prüfen ob bereits existiert
    const existing = await Holiday.findOne({ date, bundesland })
    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Feiertag existiert bereits für dieses Datum und Bundesland' },
        { status: 409 }
      )
    }

    const holiday = await Holiday.create({
      date,
      name,
      bundesland
    })

    return NextResponse.json({
      success: true,
      holiday: {
        id: holiday._id.toString(),
        date: holiday.date,
        name: holiday.name,
        bundesland: holiday.bundesland,
        createdAt: holiday.createdAt,
        updatedAt: holiday.updatedAt
      }
    }, { status: 201 })
  } catch (error) {
    logger.error('Fehler beim Erstellen des Feiertags:', error)
    return NextResponse.json(
      { success: false, error: 'Fehler beim Erstellen des Feiertags' },
      { status: 500 }
    )
  }
}
