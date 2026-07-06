import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/dbConnect'
import { requireAuth } from '@/lib/security/requireAuth'
import PlantafelAssignment from '@/lib/models/PlantafelAssignment'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req)
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  }

  const { id } = await params
  await dbConnect()

  const body = await req.json()
  const updateFields: Record<string, unknown> = {}

  if (body.mitarbeiterId !== undefined) updateFields.mitarbeiterId = body.mitarbeiterId
  if (body.projektId !== undefined) updateFields.projektId = body.projektId
  if (body.von !== undefined) updateFields.von = new Date(body.von)
  if (body.bis !== undefined) updateFields.bis = new Date(body.bis)
  if (body.rolle !== undefined) updateFields.rolle = body.rolle
  if (body.notizen !== undefined) updateFields.notizen = body.notizen
  if (body.bestaetigt !== undefined) updateFields.bestaetigt = body.bestaetigt
  if (body.setupDate !== undefined) updateFields.setupDate = body.setupDate
  if (body.dismantleDate !== undefined) updateFields.dismantleDate = body.dismantleDate

  const result = await PlantafelAssignment.findByIdAndUpdate(id, updateFields, { new: true })

  if (!result) {
    return NextResponse.json({ success: false, error: 'Einsatz nicht gefunden' }, { status: 404 })
  }

  return NextResponse.json({ success: true, data: null })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req)
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  }

  const { id } = await params
  await dbConnect()

  const result = await PlantafelAssignment.findByIdAndDelete(id)

  if (!result) {
    return NextResponse.json({ success: false, error: 'Einsatz nicht gefunden' }, { status: 404 })
  }

  return NextResponse.json({ success: true, data: null })
}
