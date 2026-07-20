import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { z } from 'zod'
import { requireAuth } from '@/lib/security/requireAuth'
import { assignImportToProject } from '@/lib/gaeb/service/projectLinkService'

const schema = z.object({ projectId: z.string().min(1) })

/**
 * POST /api/gaeb/imports/[id]/assign
 * Ordnet einen geparsten GAEB-Import einem Projekt zu (erzeugt Ausschreibung).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req, ['admin', 'superadmin'])
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  }
  const { id } = await params
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, error: 'Ungültige ID' }, { status: 400 })
  }

  const parsed = schema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success || !mongoose.Types.ObjectId.isValid(parsed.data.projectId)) {
    return NextResponse.json({ success: false, error: 'Ungültige projectId' }, { status: 400 })
  }

  const result = await assignImportToProject(id, parsed.data.projectId)
  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.error }, { status: 409 })
  }
  return NextResponse.json({ success: true })
}
