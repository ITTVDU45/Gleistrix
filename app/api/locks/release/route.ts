import { NextRequest, NextResponse } from 'next/server'
export const runtime = 'nodejs'
import dbConnect from '../../../../lib/dbConnect'
import Lock from '../../../../lib/models/Lock'
import { getToken } from 'next-auth/jwt'

export async function POST(req: NextRequest) {
  try {
    await dbConnect()

    let currentUserName: string | null = null
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })

    if (typeof token?.name === 'string' && token.name.trim()) {
      currentUserName = token.name.trim()
    } else if (typeof token?.email === 'string' && token.email.trim()) {
      currentUserName = token.email.trim()
    }

    const body = await req.json()
    const { resourceType, resourceId } = body

    if (process.env.NODE_ENV === 'development') {
      console.log('[API] Sperre-Freigabe-Request erhalten', { resourceType, resourceId, user: currentUserName })
    }

    if (!resourceType || !resourceId) {
      return NextResponse.json({ error: 'Ressourcentyp und Ressourcen-ID erforderlich' }, { status: 400 })
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('=== SPERRE FREIGEBEN ANFORDERUNG ===')
      console.log(`Ressource: ${resourceType}/${resourceId}`)
      console.log(`Benutzer: ${currentUserName ?? 'unbekannt'}`)
      console.log(`Zeit: ${new Date().toLocaleString('de-DE')}`)
    }

    const existingLocks = await Lock.find({
      resourceType,
      resourceId,
    })

    if (process.env.NODE_ENV === 'development') {
      console.log(`Gefundene Sperren: ${existingLocks.length}`)
    }

    if (existingLocks.length === 0) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[API] Keine Sperre gefunden zum Freigeben', { resourceType, resourceId })
        console.log('===========================')
      }

      return NextResponse.json({
        success: true,
        message: 'Keine Sperre zum Freigeben gefunden',
        releasedCount: 0,
      })
    }

    const result = await Lock.deleteMany({
      resourceType,
      resourceId,
    })

    if (process.env.NODE_ENV === 'development') {
      console.log('[API] Sperre erfolgreich freigegeben, sende WebSocket-Update', { deletedCount: result.deletedCount })
      console.log(`Freigegebene Sperren: ${result.deletedCount} fuer ${resourceType}/${resourceId}`)
      console.log('===========================')
    }

    try {
      const { lockWebSocket } = await import('../../../../lib/websocket')
      lockWebSocket.emitLockUpdate(resourceType, resourceId, 'released')
    } catch (_error) {
      console.log('[API] WebSocket nicht verfuegbar fuer Lock-Update')
    }

    return NextResponse.json({
      success: true,
      message: 'Sperre erfolgreich freigegeben',
      releasedCount: result.deletedCount,
    })
  } catch (error: any) {
    console.error('[API] Fehler beim Freigeben der Sperre:', error)
    return NextResponse.json({ error: 'Fehler beim Freigeben der Sperre' }, { status: 500 })
  }
}
