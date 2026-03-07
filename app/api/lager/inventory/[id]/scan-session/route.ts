import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { z } from 'zod'
import dbConnect from '@/lib/dbConnect'
import { Inventory } from '@/lib/models/Inventory'
import { requireAuth } from '@/lib/security/requireAuth'
import { getCurrentUser } from '@/lib/auth/getCurrentUser'

function parseOptionalDate(value?: string | Date | null): Date | null {
  if (!value) return null
  const parsed = typeof value === 'string' ? new Date(value) : value
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect()
    const { id } = await params
    const csrf = request.headers.get('x-csrf-intent')
    if (process.env.NODE_ENV === 'production' && csrf !== 'lager:inventory:scan-session') {
      return NextResponse.json({ success: false, message: 'Ungueltige Anforderung' }, { status: 400 })
    }
    const auth = await requireAuth(request, ['lager', 'user', 'admin', 'superadmin'])
    if (!auth.ok) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, message: 'Ungueltige ID' }, { status: 400 })
    }

    const schema = z.object({
      action: z.enum(['start', 'end']),
      name: z.string().trim().max(120).optional(),
      stichtag: z.union([z.string(), z.date()]).optional(),
      zeitraumVon: z.union([z.string(), z.date()]).nullable().optional(),
      zeitraumBis: z.union([z.string(), z.date()]).nullable().optional()
    }).passthrough()

    const parseResult = schema.safeParse(await request.json())
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, message: 'Validierungsfehler', issues: parseResult.error.flatten() },
        { status: 400 }
      )
    }

    const body = parseResult.data
    const inv = await Inventory.findById(id)
    if (!inv) return NextResponse.json({ success: false, message: 'Inventur nicht gefunden' }, { status: 404 })
    if (inv.status === 'abgeschlossen') {
      return NextResponse.json({ success: false, message: 'Inventur ist bereits abgeschlossen' }, { status: 400 })
    }

    const currentUser = await getCurrentUser(request)
    const now = new Date()

    if (typeof body.name === 'string') {
      const trimmedName = body.name.trim()
      if (!trimmedName) {
        return NextResponse.json({ success: false, message: 'Inventurname ist erforderlich' }, { status: 400 })
      }
      ;(inv as any).name = trimmedName
    }
    if (body.stichtag !== undefined) {
      const parsedStichtag = parseOptionalDate(body.stichtag)
      if (!parsedStichtag) {
        return NextResponse.json({ success: false, message: 'Ungueltiger Stichtag' }, { status: 400 })
      }
      ;(inv as any).stichtag = parsedStichtag
    }
    if (body.zeitraumVon !== undefined) {
      ;(inv as any).zeitraumVon = parseOptionalDate(body.zeitraumVon)
    }
    if (body.zeitraumBis !== undefined) {
      ;(inv as any).zeitraumBis = parseOptionalDate(body.zeitraumBis)
    }

    const finalVon = ((inv as any).zeitraumVon as Date | null | undefined) ?? null
    const finalBis = ((inv as any).zeitraumBis as Date | null | undefined) ?? null
    if (finalVon && finalBis && finalBis < finalVon) {
      return NextResponse.json(
        { success: false, message: 'Zeitraum-Ende darf nicht vor Zeitraum-Beginn liegen' },
        { status: 400 }
      )
    }

    ;(inv as any).scanSessions = (inv as any).scanSessions ?? []

    if (body.action === 'start') {
      if (!(inv as any).activeScanSessionId) {
        const sessionId = new mongoose.Types.ObjectId().toString()
        ;(inv as any).activeScanSessionId = sessionId
        ;(inv as any).scanSessions.push({
          sessionId,
          startedAt: now,
          endedAt: null,
          startedBy: currentUser?._id,
          scans: 0
        })
      }
      if (inv.status === 'offen') {
        inv.status = 'in_bearbeitung'
      }
    }

    if (body.action === 'end') {
      const activeSessionId = (inv as any).activeScanSessionId as string | null
      if (activeSessionId) {
        const session = ((inv as any).scanSessions ?? []).find((s: { sessionId?: string }) => s.sessionId === activeSessionId)
        if (session) {
          session.endedAt = now
          session.endedBy = currentUser?._id
        }
        ;(inv as any).activeScanSessionId = null
      }
    }

    await inv.save()

    const doc = await Inventory.findById(id)
      .populate('positionen.artikelId', 'bezeichnung artikelnummer barcode bestand')
      .lean()

    return NextResponse.json({ success: true, data: doc })
  } catch (error) {
    console.error('Fehler bei Inventur-Scan-Session:', error)
    return NextResponse.json(
      { success: false, message: 'Fehler beim Verarbeiten der Inventur-Scan-Session' },
      { status: 500 }
    )
  }
}
