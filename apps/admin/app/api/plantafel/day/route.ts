import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import dbConnect from '@/lib/dbConnect'
import { requireAuth } from '@/lib/security/requireAuth'
import PlantafelAssignment from '@/lib/models/PlantafelAssignment'
import { Project } from '@/lib/models/Project'

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function toArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  }

  const dateKey = new URL(req.url).searchParams.get('date')
  if (!dateKey || !DATE_KEY_PATTERN.test(dateKey)) {
    return NextResponse.json(
      { success: false, error: 'date im Format yyyy-MM-dd ist erforderlich' },
      { status: 400 }
    )
  }

  await dbConnect()

  const dayStart = new Date(`${dateKey}T00:00:00`)
  const dayEnd = new Date(`${dateKey}T23:59:59.999`)

  // 1. Projekte mit Plantafel-Einsätzen an diesem Tag
  const assignments = await PlantafelAssignment.find(
    { von: { $lte: dayEnd }, bis: { $gte: dayStart } },
    { projektId: 1 }
  ).lean()

  const assignedProjectIds = Array.from(
    new Set(
      assignments
        .map((a: Record<string, unknown>) => a.projektId)
        .filter((id): id is string => typeof id === 'string' && mongoose.Types.ObjectId.isValid(id))
    )
  ).map((id) => new mongoose.Types.ObjectId(id))

  // 2. Union: zugewiesene Projekte + Laufzeit deckt Tag ab + Zeiteinträge am Tag.
  //    '~' als Obergrenzen-Suffix fängt ISO-Strings mit Zeitanteil am selben Tag ab.
  const orConditions: Record<string, unknown>[] = [
    { datumBeginn: { $lte: `${dateKey}~` }, datumEnde: { $gte: dateKey } },
    { [`mitarbeiterZeiten.${dateKey}.0`]: { $exists: true } },
  ]
  if (assignedProjectIds.length > 0) {
    orConditions.push({ _id: { $in: assignedProjectIds } })
  }

  const projectionFields = [
    'name', 'status', 'auftraggeber', 'baustelle', 'auftragsnummer', 'sapNummer',
    'telefonnummer', 'atwsImEinsatz', 'anzahlAtws', 'datumBeginn', 'datumEnde',
    `mitarbeiterZeiten.${dateKey}`, `fahrzeuge.${dateKey}`, `technik.${dateKey}`,
  ].join(' ')
  const projects = await Project.find({ $or: orConditions }).select(projectionFields).lean()

  const dayProjects = projects.map((p: Record<string, unknown>) => {
    const zeiten = toArray<Record<string, unknown>>(
      (p.mitarbeiterZeiten as Record<string, unknown> | undefined)?.[dateKey]
    )
    const fahrzeuge = toArray<Record<string, unknown>>(
      (p.fahrzeuge as Record<string, unknown> | undefined)?.[dateKey]
    )
    const technik = toArray<Record<string, unknown>>(
      (p.technik as Record<string, unknown> | undefined)?.[dateKey]
    )

    return {
      id: String(p._id),
      name: (p.name as string) || '',
      status: (p.status as string) || 'kein Status',
      auftraggeber: (p.auftraggeber as string) || '',
      baustelle: (p.baustelle as string) || '',
      auftragsnummer: (p.auftragsnummer as string) || '',
      sapNummer: (p.sapNummer as string) || '',
      telefonnummer: (p.telefonnummer as string) || '',
      atwsImEinsatz: Boolean(p.atwsImEinsatz),
      anzahlAtws: Number(p.anzahlAtws) || 0,
      datumBeginn: (p.datumBeginn as string) || '',
      datumEnde: (p.datumEnde as string) || '',
      zeiten,
      fahrzeuge,
      technik,
    }
  })

  return NextResponse.json({
    success: true,
    data: {
      date: dateKey,
      projects: dayProjects,
    },
  })
}
