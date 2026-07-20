import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import mongoose from 'mongoose'
import dbConnect from '@/lib/dbConnect'
import { logger } from '@/lib/logger'

/** Aktueller Portal-Benutzer (nur Rolle 'subunternehmen'). */
export async function GET(req: NextRequest) {
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
    if (!token?.id) {
      return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
    }

    await dbConnect()
    const db = mongoose.connection.db
    if (!db) {
      return NextResponse.json({ error: 'Datenbankverbindung nicht verfügbar' }, { status: 500 })
    }

    let objectId: mongoose.Types.ObjectId
    try {
      objectId = new mongoose.Types.ObjectId(String(token.id))
    } catch {
      return NextResponse.json({ error: 'Ungültige Benutzer-ID' }, { status: 401 })
    }

    const user = await db.collection('users').findOne({ _id: objectId })
    if (!user || user.role !== 'subunternehmen') {
      return NextResponse.json({ error: 'Benutzer nicht gefunden' }, { status: 401 })
    }
    if (user.isActive === false) {
      return NextResponse.json({ error: 'Account ist deaktiviert' }, { status: 401 })
    }

    return NextResponse.json({
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name || '',
        role: user.role,
        phone: user.phone,
        lastLogin: user.lastLogin,
      },
    })
  } catch (error) {
    logger.error('Portal: Auth-Verifizierung fehlgeschlagen', error)
    return NextResponse.json({ error: 'Ein Fehler ist aufgetreten' }, { status: 500 })
  }
}
