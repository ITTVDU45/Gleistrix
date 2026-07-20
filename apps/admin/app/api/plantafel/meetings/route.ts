import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/dbConnect'
import { requireAuth } from '@/lib/security/requireAuth'
import PlantafelMeeting from '@/lib/models/PlantafelMeeting'
import { syncMeetingToCalendar } from '@/lib/services/microsoft/meeting-sync'

interface AttendeeInput {
  employeeId?: string | null
  name?: string
  email?: string
}

/** GET: Meetings im Zeitraum (from/to). */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  }
  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  if (!from || !to) {
    return NextResponse.json({ success: false, error: 'from und to sind erforderlich' }, { status: 400 })
  }

  await dbConnect()
  const meetings = await PlantafelMeeting.find({
    von: { $lte: new Date(to) },
    bis: { $gte: new Date(from) },
  }).lean()

  return NextResponse.json({ success: true, data: meetings })
}

/** POST: Meeting anlegen (+ Teams-Meeting im verbundenen Postfach). */
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  }

  await dbConnect()
  const body = await req.json()
  const { titel, von, bis, notizen } = body

  if (!titel || !von || !bis) {
    return NextResponse.json({ success: false, error: 'titel, von und bis sind erforderlich' }, { status: 400 })
  }

  const modus = body.modus === 'vorOrt' ? 'vorOrt' : 'teams'
  const ort = modus === 'vorOrt' ? String(body.ort || '').trim() : ''

  // Teilnehmer normalisieren: nur mit gültiger E-Mail übernehmen.
  const attendees = (Array.isArray(body.attendees) ? (body.attendees as AttendeeInput[]) : [])
    .filter((a) => typeof a.email === 'string' && a.email.includes('@'))
    .map((a) => ({ employeeId: a.employeeId || null, name: a.name || '', email: a.email!.trim() }))

  const meeting = await PlantafelMeeting.create({
    titel: String(titel).trim(),
    von: new Date(von),
    bis: new Date(bis),
    modus,
    ort,
    notizen: notizen || '',
    attendees,
    createdByUserId: auth.token?.id || null,
  })

  // Teams-Meeting erzeugen + Teilnehmer einladen (Ergebnis für UI-Feedback)
  const sync = await syncMeetingToCalendar(String(meeting._id))

  return NextResponse.json({ success: true, data: { id: String(meeting._id), sync } }, { status: 201 })
}
