import { NextRequest, NextResponse } from 'next/server'
export const runtime = 'nodejs'
import dbConnect from '../../../../lib/dbConnect'
import Lock from '../../../../lib/models/Lock'
import { resolveLockUser } from '../../../../lib/auth/resolveLockUser'
import mongoose from 'mongoose'

export async function POST(req: NextRequest) {
  try {
    await dbConnect()

    const resolvedUser = await resolveLockUser(req)
    if (!resolvedUser.ok) {
      return NextResponse.json({ error: resolvedUser.error }, { status: resolvedUser.status })
    }

    const body = await req.json()
    const { resourceType, resourceId } = body

    if (!resourceType || !resourceId) {
      return NextResponse.json({ error: 'Ressourcentyp und Ressourcen-ID erforderlich' }, { status: 400 })
    }

    const effectiveUserId = String(resolvedUser.effectiveUserId)
    if (!mongoose.isValidObjectId(effectiveUserId)) {
      return NextResponse.json({
        success: true,
        updated: false,
        message: 'Aktivitaet nicht aktualisiert (ungueltige Benutzer-ID)',
      })
    }

    const updated = await Lock.updateActivity(
      String(resourceType),
      String(resourceId),
      effectiveUserId
    )

    return NextResponse.json({
      success: true,
      updated,
      message: updated ? 'Aktivitaet aktualisiert' : 'Keine Sperre zum Aktualisieren gefunden',
    })
  } catch (error: any) {
    console.error('Fehler beim Aktualisieren der Aktivitaet:', error)
    return NextResponse.json({ error: 'Fehler beim Aktualisieren der Aktivitaet' }, { status: 500 })
  }
}
