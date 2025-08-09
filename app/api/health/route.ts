import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import dbConnect from '@/lib/dbConnect'

export async function GET(_req: NextRequest) {
  try {
    const startedAt = Date.now()
    await dbConnect()
    const ping = await mongoose.connection.db.admin().ping()
    const durationMs = Date.now() - startedAt
    const res = NextResponse.json({
      ok: true,
      db: ping?.ok === 1 ? 'up' : 'unknown',
      durationMs,
      database: mongoose.connection.db.databaseName,
    })
    // Kennzeichne Health-Antworten, damit Middleware/Infra sie unverändert passieren lässt
    res.headers.set('x-no-app-shell', '1')
    res.headers.set('Cache-Control', 'no-store')
    return res
  } catch (error: any) {
    const res = NextResponse.json({ ok: false, error: error?.message || 'unknown' }, { status: 500 })
    res.headers.set('x-no-app-shell', '1')
    res.headers.set('Cache-Control', 'no-store')
    return res
  }
}


