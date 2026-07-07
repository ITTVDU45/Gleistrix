import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/dbConnect'
import { requireAuth } from '@/lib/security/requireAuth'
import PlantafelMeeting from '@/lib/models/PlantafelMeeting'
import { syncMeetingToCalendar, removeMeetingFromCalendar } from '@/lib/services/microsoft/meeting-sync'

interface AttendeeInput {
  employeeId?: string | null
  name?: string
  email?: string
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req)
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  }
  const { id } = await params
  await dbConnect()
  const meeting = await PlantafelMeeting.findById(id).lean()
  if (!meeting) {
    return NextResponse.json({ success: false, error: 'Meeting nicht gefunden' }, { status: 404 })
  }
  return NextResponse.json({ success: true, data: meeting })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req)
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  }
  const { id } = await params
  await dbConnect()

  const body = await req.json()
  const update: Record<string, unknown> = {}
  if (body.titel !== undefined) update.titel = String(body.titel).trim()
  if (body.von !== undefined) update.von = new Date(body.von)
  if (body.bis !== undefined) update.bis = new Date(body.bis)
  if (body.notizen !== undefined) update.notizen = body.notizen
  if (body.attendees !== undefined) {
    update.attendees = (Array.isArray(body.attendees) ? (body.attendees as AttendeeInput[]) : [])
      .filter((a) => typeof a.email === 'string' && a.email.includes('@'))
      .map((a) => ({ employeeId: a.employeeId || null, name: a.name || '', email: a.email!.trim() }))
  }

  const result = await PlantafelMeeting.findByIdAndUpdate(id, update, { new: true })
  if (!result) {
    return NextResponse.json({ success: false, error: 'Meeting nicht gefunden' }, { status: 404 })
  }

  await syncMeetingToCalendar(id)

  return NextResponse.json({ success: true, data: null })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req)
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  }
  const { id } = await params
  await dbConnect()

  const result = await PlantafelMeeting.findByIdAndDelete(id)
  if (!result) {
    return NextResponse.json({ success: false, error: 'Meeting nicht gefunden' }, { status: 404 })
  }

  await removeMeetingFromCalendar((result as { msCalendar?: { eventId?: string | null } | null }).msCalendar)

  return NextResponse.json({ success: true, data: null })
}
