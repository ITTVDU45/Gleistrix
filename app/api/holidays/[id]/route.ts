/**
 * Feiertags-API - Einzelner Feiertag
 * GET: Einzelnen Feiertag abrufen
 * PUT: Feiertag aktualisieren
 * DELETE: Feiertag löschen
 */

import { NextResponse } from 'next/server'
import dbConnect from '@/lib/dbConnect'
import { Holiday } from '@/lib/models/Holiday'
import { getCurrentUser } from '@/lib/auth/getCurrentUser'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET: Einzelnen Feiertag abrufen
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params
    await dbConnect()

    const holiday = await Holiday.findById(id).lean()
    if (!holiday) {
      return NextResponse.json(
        { success: false, error: 'Feiertag nicht gefunden' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      holiday: {
        id: (holiday as any)._id.toString(),
        date: (holiday as any).date,
        name: (holiday as any).name,
        bundesland: (holiday as any).bundesland,
        createdAt: (holiday as any).createdAt,
        updatedAt: (holiday as any).updatedAt
      }
    })
  } catch (error) {
    console.error('Fehler beim Laden des Feiertags:', error)
    return NextResponse.json(
      { success: false, error: 'Fehler beim Laden des Feiertags' },
      { status: 500 }
    )
  }
}

// PUT: Feiertag aktualisieren
export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const currentUser = await getCurrentUser(request as any)
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: 'Nicht autorisiert' },
        { status: 401 }
      )
    }

    // Nur Admins dürfen Feiertage bearbeiten
    if ((currentUser as any).role !== 'admin' && (currentUser as any).role !== 'superadmin') {
      return NextResponse.json(
        { success: false, error: 'Keine Berechtigung' },
        { status: 403 }
      )
    }

    const { id } = await params
    await dbConnect()

    const body = await request.json()
    const { date, name, bundesland } = body

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

    // Prüfen ob Feiertag existiert
    const existing = await Holiday.findById(id)
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Feiertag nicht gefunden' },
        { status: 404 }
      )
    }

    // Prüfen ob Datum/Bundesland-Kombination bereits existiert (außer bei sich selbst)
    const duplicate = await Holiday.findOne({
      _id: { $ne: id },
      date,
      bundesland: bundesland || existing.bundesland
    })
    if (duplicate) {
      return NextResponse.json(
        { success: false, error: 'Feiertag existiert bereits für dieses Datum und Bundesland' },
        { status: 409 }
      )
    }

    const updated = await Holiday.findByIdAndUpdate(
      id,
      {
        date,
        name,
        bundesland: bundesland || existing.bundesland
      },
      { new: true, runValidators: true }
    )

    return NextResponse.json({
      success: true,
      holiday: {
        id: updated._id.toString(),
        date: updated.date,
        name: updated.name,
        bundesland: updated.bundesland,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt
      }
    })
  } catch (error) {
    console.error('Fehler beim Aktualisieren des Feiertags:', error)
    return NextResponse.json(
      { success: false, error: 'Fehler beim Aktualisieren des Feiertags' },
      { status: 500 }
    )
  }
}

// DELETE: Feiertag löschen
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const currentUser = await getCurrentUser(request as any)
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: 'Nicht autorisiert' },
        { status: 401 }
      )
    }

    // Nur Admins dürfen Feiertage löschen
    if ((currentUser as any).role !== 'admin' && (currentUser as any).role !== 'superadmin') {
      return NextResponse.json(
        { success: false, error: 'Keine Berechtigung' },
        { status: 403 }
      )
    }

    const { id } = await params
    await dbConnect()

    const deleted = await Holiday.findByIdAndDelete(id)
    if (!deleted) {
      return NextResponse.json(
        { success: false, error: 'Feiertag nicht gefunden' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Feiertag erfolgreich gelöscht'
    })
  } catch (error) {
    console.error('Fehler beim Löschen des Feiertags:', error)
    return NextResponse.json(
      { success: false, error: 'Fehler beim Löschen des Feiertags' },
      { status: 500 }
    )
  }
}
