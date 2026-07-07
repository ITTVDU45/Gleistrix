import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/dbConnect'
import { requireAuth } from '@/lib/security/requireAuth'
import PlantafelAssignment from '@/lib/models/PlantafelAssignment'
import { syncAssignmentToCalendar, removeAssignmentFromCalendar } from '@/lib/services/microsoft/plantafel-sync'
import mongoose from 'mongoose'

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
  if (body.einsatzLinkId !== undefined) updateFields.einsatzLinkId = body.einsatzLinkId

  const db = mongoose.connection.db
  if (db) {
    if (body.projektId) {
      try {
        const project = await db.collection('projects').findOne({ _id: new mongoose.Types.ObjectId(body.projektId) })
        if (project) updateFields.projektName = project.name || ''
      } catch { /* ignore */ }
    }
    if (body.mitarbeiterId) {
      try {
        const employee = await db.collection('employees').findOne({ _id: new mongoose.Types.ObjectId(body.mitarbeiterId) })
        if (employee) updateFields.mitarbeiterName = employee.name || ''
      } catch { /* ignore */ }
    } else if (body.mitarbeiterId === null || body.mitarbeiterId === '') {
      updateFields.mitarbeiterName = ''
    }
  }

  const result = await PlantafelAssignment.findByIdAndUpdate(id, updateFields, { new: true })

  if (!result) {
    return NextResponse.json({ success: false, error: 'Einsatz nicht gefunden' }, { status: 404 })
  }

  // Best-effort: verknüpften Outlook-/Teams-Termin aktualisieren (oder anlegen)
  await syncAssignmentToCalendar(id)

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

  // Best-effort: verknüpften Outlook-/Teams-Termin entfernen
  await removeAssignmentFromCalendar((result as { msCalendar?: { eventId?: string | null } | null }).msCalendar)

  return NextResponse.json({ success: true, data: null })
}
