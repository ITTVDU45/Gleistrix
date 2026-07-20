import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/dbConnect'
import { requireAuth } from '@/lib/security/requireAuth'
import Ausschreibung from '@/lib/models/Ausschreibung'

/**
 * GET /api/projects/[id]/ausschreibungen
 * Listet die (GAEB-)Ausschreibungen/LVs eines Projekts.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req)
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  }
  const { id } = await params
  await dbConnect()

  const items = (await Ausschreibung.find({ projectId: id }).sort({ createdAt: -1 }).lean()) as Array<
    Record<string, unknown>
  >

  const data = items.map((a) => ({
    id: String(a._id),
    projectId: String(a.projectId),
    kind: a.kind,
    source: a.source,
    name: a.name,
    version: a.version ?? null,
    phase: a.phase ?? null,
    importJobId: a.importJobId ?? null,
    boqId: a.boqId ?? null,
    positionCount: a.positionCount ?? 0,
    netSum: a.netSum ?? null,
    currency: a.currency ?? 'EUR',
    createdAt: a.createdAt,
  }))

  return NextResponse.json({ success: true, data })
}
