import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { z } from 'zod'
import dbConnect from '@/lib/dbConnect'
import { Inventory } from '@/lib/models/Inventory'
import { requireAuth } from '@/lib/security/requireAuth'
import { getCurrentUser } from '@/lib/auth/getCurrentUser'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect()
    const { id } = await params
    const csrf = request.headers.get('x-csrf-intent')
    if (process.env.NODE_ENV === 'production' && csrf !== 'lager:inventory:scan') {
      return NextResponse.json({ success: false, message: 'Ungueltige Anforderung' }, { status: 400 })
    }
    const auth = await requireAuth(request, ['lager', 'user', 'admin', 'superadmin'])
    if (!auth.ok) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, message: 'Ungueltige ID' }, { status: 400 })
    }

    const schema = z.object({
      artikelId: z.string(),
      code: z.string().trim().min(1).max(200),
      scannedAt: z.union([z.string(), z.date()]).optional()
    })
    const parseResult = schema.safeParse(await request.json())
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, message: 'Validierungsfehler', issues: parseResult.error.flatten() },
        { status: 400 }
      )
    }

    const body = parseResult.data
    if (!mongoose.Types.ObjectId.isValid(body.artikelId)) {
      return NextResponse.json({ success: false, message: 'Ungueltige Artikel-ID' }, { status: 400 })
    }

    const inv = await Inventory.findById(id)
    if (!inv) return NextResponse.json({ success: false, message: 'Inventur nicht gefunden' }, { status: 404 })
    if (inv.status === 'abgeschlossen') {
      return NextResponse.json({ success: false, message: 'Inventur ist bereits abgeschlossen' }, { status: 400 })
    }

    const articleId = new mongoose.Types.ObjectId(body.artikelId)
    const pos = (inv.positionen as {
      artikelId: mongoose.Types.ObjectId
      sollMenge: number
      istMenge: number
      differenz: number
    }[]).find((p) => p.artikelId?.toString() === articleId.toString())

    if (!pos) {
      return NextResponse.json({ success: false, message: 'Artikel ist nicht Teil dieser Inventur' }, { status: 400 })
    }

    const currentUser = await getCurrentUser(request)
    const scanTime = body.scannedAt ? new Date(body.scannedAt) : new Date()
    const now = Number.isNaN(scanTime.getTime()) ? new Date() : scanTime

    let sessionId = (inv as { activeScanSessionId?: string | null }).activeScanSessionId ?? null
    if (!sessionId) {
      sessionId = new mongoose.Types.ObjectId().toString()
      ;(inv as any).scanSessions = (inv as any).scanSessions ?? []
      ;(inv as any).scanSessions.push({
        sessionId,
        startedAt: now,
        endedAt: null,
        startedBy: currentUser?._id,
        scans: 0
      })
      ;(inv as any).activeScanSessionId = sessionId
    }

    pos.istMenge = (pos.istMenge ?? 0) + 1
    pos.differenz = (pos.istMenge ?? 0) - (pos.sollMenge ?? 0)

    ;(inv as any).scanEvents = (inv as any).scanEvents ?? []
    ;(inv as any).scanEvents.push({
      artikelId: articleId,
      code: body.code,
      scannedAt: now,
      scannedBy: currentUser?._id,
      sessionId
    })

    const session = ((inv as any).scanSessions ?? []).find((s: { sessionId?: string }) => s.sessionId === sessionId)
    if (session) {
      session.scans = (session.scans ?? 0) + 1
    }

    ;(inv as any).lastScanAt = now
    if (inv.status === 'offen') {
      inv.status = 'in_bearbeitung'
    }

    await inv.save()

    const doc = await Inventory.findById(id)
      .populate('positionen.artikelId', 'bezeichnung artikelnummer barcode bestand')
      .lean()

    return NextResponse.json({ success: true, data: doc })
  } catch (error) {
    console.error('Fehler beim Inventur-Scan:', error)
    return NextResponse.json(
      { success: false, message: 'Fehler beim Verarbeiten des Inventur-Scans' },
      { status: 500 }
    )
  }
}
