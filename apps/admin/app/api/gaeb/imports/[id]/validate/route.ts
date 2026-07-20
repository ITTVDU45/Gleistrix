import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { requireAuth } from '@/lib/security/requireAuth'
import { runGaebImport } from '@/lib/gaeb/service/gaebImportService'

/**
 * POST /api/gaeb/imports/[id]/validate
 * Startet Validierung + Parsing für einen Import-Job.
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

  const result = await runGaebImport(id)
  return NextResponse.json({ success: result.ok, data: result }, { status: result.ok ? 200 : 422 })
}
