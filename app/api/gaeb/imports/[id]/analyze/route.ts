import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import dbConnect from '@/lib/dbConnect'
import { requireAuth } from '@/lib/security/requireAuth'
import GaebImportJob from '@/lib/models/GaebImportJob'
import GaebBillOfQuantities from '@/lib/models/GaebBillOfQuantities'
import { analyzeBoq } from '@/lib/gaeb/agent/analyzeBoq'
import type { GaebBillOfQuantities as GaebBoqType } from '@/types/gaeb'

/**
 * POST /api/gaeb/imports/[id]/analyze
 * Regelbasierte GAEB-Agent-Analyse des geparsten LVs.
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

  await dbConnect()

  const job = (await GaebImportJob.findById(id).lean()) as Record<string, unknown> | null
  if (!job) {
    return NextResponse.json({ success: false, error: 'Import nicht gefunden' }, { status: 404 })
  }
  if (!job.boqId) {
    return NextResponse.json(
      { success: false, error: 'Noch keine geparste Struktur – bitte zuerst „Prüfen".' },
      { status: 409 }
    )
  }

  const boqDoc = (await GaebBillOfQuantities.findById(String(job.boqId)).lean()) as Record<string, unknown> | null
  if (!boqDoc) {
    return NextResponse.json({ success: false, error: 'LV-Struktur nicht gefunden' }, { status: 404 })
  }

  const boq = { ...(boqDoc as unknown as GaebBoqType), _id: String(boqDoc._id), importJobId: id }
  const analysis = analyzeBoq(boq)

  return NextResponse.json({ success: true, data: analysis })
}
