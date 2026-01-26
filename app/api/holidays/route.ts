/**
 * Feiertags-API - CRUD Operationen für Feiertage
 * GET: Liste aller Feiertage (optional gefiltert nach Jahr, Bundesland, Datumsbereich)
 * POST: Neuen Feiertag erstellen
 */

import { NextResponse } from 'next/server'
import dbConnect from '@/lib/dbConnect'
import { Holiday } from '@/lib/models/Holiday'
import { getCurrentUser } from '@/lib/auth/getCurrentUser'

// GET: Liste aller Feiertage
export async function GET(request: Request) {
  try {
    await dbConnect()

    const { searchParams } = new URL(request.url)
    const year = searchParams.get('year')
    const bundesland = searchParams.get('bundesland')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    // Filter aufbauen
    const filter: Record<string, any> = {}

    if (year) {
      filter.date = { $regex: `^${year}-` }
    }

    if (startDate && endDate) {
      filter.date = { $gte: startDate, $lte: endDate }
    } else if (startDate) {
      filter.date = { $gte: startDate }
    } else if (endDate) {
      filter.date = { $lte: endDate }
    }

    if (bundesland) {
      // Bundesweit (ALL) oder spezifisches Bundesland
      filter.$or = [
        { bundesland: bundesland },
        { bundesland: 'ALL' }
      ]
    }

    const holidays = await Holiday.find(filter).sort({ date: 1 }).lean()

    return NextResponse.json({
      success: true,
      holidays: holidays.map((h: any) => ({
        id: h._id.toString(),
        date: h.date,
        name: h.name,
        bundesland: h.bundesland,
        createdAt: h.createdAt,
        updatedAt: h.updatedAt
      }))
    })
  } catch (error) {
    console.error('Fehler beim Laden der Feiertage:', error)
    return NextResponse.json(
      { success: false, error: 'Fehler beim Laden der Feiertage' },
      { status: 500 }
    )
  }
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
    console.error('Fehler beim Erstellen des Feiertags:', error)
    return NextResponse.json(
      { success: false, error: 'Fehler beim Erstellen des Feiertags' },
      { status: 500 }
    )
  }
}
