import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import dbConnect from '@/lib/dbConnect'
import { getErrorMessage } from '@/lib/errors'

export async function GET(_req: NextRequest) {
  try {
    const startedAt = Date.now()
    await dbConnect()
    const db = mongoose.connection.db
    if (!db) {
      return NextResponse.json({ ok: false, error: 'Datenbankverbindung nicht verfügbar' }, { status: 500 })
    }
    const ping = await db.admin().ping()
    const durationMs = Date.now() - startedAt
    const res = NextResponse.json({
      ok: true,
      db: ping?.ok === 1 ? 'up' : 'unknown',
      durationMs,
      database: db.databaseName,
    })
    // Kennzeichne Health-Antworten, damit Middleware/Infra sie unverändert passieren lässt
    res.headers.set('x-no-app-shell', '1')
    res.headers.set('Cache-Control', 'no-store')
    return res
  } catch (error: unknown) {
    const res = NextResponse.json({ ok: false, error: getErrorMessage(error, 'unknown') }, { status: 500 })
    res.headers.set('x-no-app-shell', '1')
    res.headers.set('Cache-Control', 'no-store')
    return res
  }
}


