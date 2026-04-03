import { NextRequest, NextResponse } from 'next/server'
export const runtime = 'nodejs'
import dbConnect from '../../../../lib/dbConnect'
import Lock from '../../../../lib/models/Lock'
import { resolveLockUser } from '../../../../lib/auth/resolveLockUser'

export async function GET(req: NextRequest) {
  try {
    await dbConnect()

    const resolvedUser = await resolveLockUser(req)
    if (!resolvedUser.ok) {
      return NextResponse.json({ error: resolvedUser.error }, { status: resolvedUser.status })
    }

    const { searchParams } = new URL(req.url)
    const resourceType = searchParams.get('resourceType')
    const resourceId = searchParams.get('resourceId')

    if (!resourceType || !resourceId) {
      return NextResponse.json({ error: 'Ressourcentyp und Ressourcen-ID erforderlich' }, { status: 400 })
    }

    const lock = await Lock.isLocked(resourceType, resourceId)

    if (!lock) {
      return NextResponse.json({
        success: true,
        isLocked: false,
        lock: null,
      })
    }

    const rawUserId: any = lock.lockedBy?.userId as any
    let lockUserIdStr: string | null = null

    if (typeof rawUserId === 'string') {
      lockUserIdStr = rawUserId
    } else if (rawUserId && typeof rawUserId.toString === 'function') {
      lockUserIdStr = rawUserId.toString()
    } else if (rawUserId && rawUserId._id && typeof rawUserId._id.toString === 'function') {
      lockUserIdStr = rawUserId._id.toString()
    }

    const currentUserId = String(resolvedUser.effectiveUserId)
    const isOwnLock = lockUserIdStr === currentUserId

    if (process.env.NODE_ENV === 'development') {
      console.log('=== SPERRE PRUEFUNG ===')
      console.log(`Aktueller Benutzer: ${currentUserId}`)
      console.log(`Sperre von: ${lockUserIdStr} (${lock.lockedBy?.name || '-'})`)
      console.log(`Ist eigene Sperre: ${isOwnLock}`)
      console.log('========================')
    }

    return NextResponse.json({
      success: true,
      isLocked: true,
      isOwnLock,
      lock: {
        id: lock._id?.toString?.() || undefined,
        resourceType: lock.resourceType,
        resourceId: lock.resourceId,
        lockedBy: lock.lockedBy,
        lockedAt: lock.lockedAt,
        lastActivity: lock.lastActivity,
      },
    })
  } catch (error: any) {
    console.error('Fehler beim Pruefen der Sperre:', error)
    return NextResponse.json({ error: 'Fehler beim Pruefen der Sperre' }, { status: 500 })
  }
}
