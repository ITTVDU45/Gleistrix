import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/dbConnect'
import { requireAuth } from '@/lib/security/requireAuth'
import PlantafelAssignment from '@/lib/models/PlantafelAssignment'
import mongoose from 'mongoose'

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

  const query: Record<string, unknown> = {
    von: { $lte: new Date(to) },
    bis: { $gte: new Date(from) },
  }

  const employeeIds = searchParams.get('employeeIds')
  if (employeeIds) {
    query.mitarbeiterId = { $in: employeeIds.split(',') }
  }

  const projectIds = searchParams.get('projectIds')
  if (projectIds) {
    query.projektId = { $in: projectIds.split(',') }
  }

  const assignments = await PlantafelAssignment.find(query).lean()

  const events = assignments.map((a: Record<string, unknown>) => ({
    id: String(a._id),
    title: (a.projektName as string) || 'Kein Projekt',
    start: a.von,
    end: a.bis,
    resourceId: (a.mitarbeiterId as string) || '__unassigned__',
    type: 'einsatz',
    sourceType: 'einsatz',
    sourceId: String(a._id),
    mitarbeiterId: a.mitarbeiterId,
    mitarbeiterName: a.mitarbeiterName,
    projektId: a.projektId,
    projektName: a.projektName,
    notes: a.notizen,
    bestaetigt: a.bestaetigt,
    rolle: a.rolle,
    setupDate: a.setupDate,
    dismantleDate: a.dismantleDate,
    hasConflict: false,
  }))

  // Ressourcen laden
  const db = mongoose.connection.db
  if (!db) {
    return NextResponse.json({ success: false, error: 'DB nicht verbunden' }, { status: 500 })
  }

  const [employees, projects] = await Promise.all([
    db.collection('employees').find({ status: { $ne: 'nicht aktiv' } }).toArray(),
    db.collection('projects').find({ status: 'aktiv' }).toArray(),
  ])

  const view = searchParams.get('view') || 'team'
  const resources = view === 'team'
    ? employees.map((e) => ({
        resourceId: String(e._id),
        resourceTitle: e.name || '',
        type: 'employee' as const,
        aktiv: e.status === 'aktiv',
      }))
    : projects.map((p) => ({
        resourceId: String(p._id),
        resourceTitle: p.name || '',
        type: 'project' as const,
        projektname: p.name,
        auftraggeber: p.auftraggeber,
        status: p.status,
        baustelle: p.baustelle,
      }))

  return NextResponse.json({
    success: true,
    data: {
      events,
      resources,
      conflicts: [],
      meta: { from, to, totalEvents: events.length, totalConflicts: 0 },
    },
  })
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  }

  await dbConnect()

  const body = await req.json()
  const { mitarbeiterId, projektId, von, bis, rolle, notizen, bestaetigt, setupDate, dismantleDate } = body

  if (!projektId || !von || !bis) {
    return NextResponse.json({ success: false, error: 'projektId, von und bis sind erforderlich' }, { status: 400 })
  }

  // Projekt- und Mitarbeiternamen auflösen
  const db = mongoose.connection.db
  if (!db) {
    return NextResponse.json({ success: false, error: 'DB nicht verbunden' }, { status: 500 })
  }

  let projektName = ''
  let mitarbeiterName = ''

  try {
    const project = await db.collection('projects').findOne({ _id: new mongoose.Types.ObjectId(projektId) })
    projektName = project?.name || ''
  } catch { /* ignore */ }

  if (mitarbeiterId) {
    try {
      const employee = await db.collection('employees').findOne({ _id: new mongoose.Types.ObjectId(mitarbeiterId) })
      mitarbeiterName = employee?.name || ''
    } catch { /* ignore */ }
  }

  const assignment = await PlantafelAssignment.create({
    mitarbeiterId: mitarbeiterId || null,
    mitarbeiterName,
    projektId,
    projektName,
    von: new Date(von),
    bis: new Date(bis),
    rolle: rolle || '',
    notizen: notizen || '',
    bestaetigt: bestaetigt || false,
    setupDate: setupDate || null,
    dismantleDate: dismantleDate || null,
  })

  return NextResponse.json({ success: true, data: { id: String(assignment._id) } }, { status: 201 })
}
