import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/dbConnect'
import { LagerRecipient } from '@/lib/models/LagerRecipient'
import { Employee } from '@/lib/models/Employee'
import { requireAuth } from '@/lib/security/requireAuth'
import { z } from 'zod'

type RecipientEmployee = {
  id: string
  name: string
}

function normalizeRecipientName(name: string): string {
  return name.trim().replace(/\s+/g, ' ')
}

function normalizeRecipientKey(name: string): string {
  return normalizeRecipientName(name).toLocaleLowerCase('de-DE')
}

async function migrateLegacyRecipients(): Promise<void> {
  const legacyDoc = await LagerRecipient.db
    .collection('lager_recipient_lists')
    .findOne<{ recipients?: string[]; scope?: string }>({ scope: 'global' })

  const legacyRecipients = (legacyDoc?.recipients ?? [])
    .map((recipient) => normalizeRecipientName(recipient ?? ''))
    .filter(Boolean)

  if (legacyRecipients.length === 0) return

  await LagerRecipient.bulkWrite(
    legacyRecipients.map((recipient) => ({
      updateOne: {
        filter: { normalizedName: normalizeRecipientKey(recipient) },
        update: {
          $setOnInsert: {
            name: recipient,
            normalizedName: normalizeRecipientKey(recipient),
            active: true
          }
        },
        upsert: true
      }
    })),
    { ordered: false }
  )
}

async function listAvailableEmployees(): Promise<RecipientEmployee[]> {
  const employees = await Employee.find({})
    .sort({ name: 1 })
    .select({ _id: 1, name: 1 })
    .lean<Array<{ _id?: unknown; name?: string }>>()

  return employees
    .map((employee) => {
      const id = String(employee._id ?? '')
      const name = normalizeRecipientName(String(employee.name ?? ''))
      return { id, name }
    })
    .filter((employee) => Boolean(employee.id && employee.name))
}

async function buildPayload() {
  await migrateLegacyRecipients()

  const [recipients, employees] = await Promise.all([
    LagerRecipient.find({ active: true })
      .sort({ name: 1 })
      .lean<Array<{ name?: string }>>(),
    listAvailableEmployees()
  ])

  return {
    success: true,
    recipients: recipients.map((recipient) => recipient.name ?? '').filter(Boolean),
    employees
  }
}

export async function GET(request: NextRequest) {
  try {
    await dbConnect()
    const auth = await requireAuth(request, ['lager', 'user', 'admin', 'superadmin'])
    if (!auth.ok) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

    return NextResponse.json(await buildPayload())
  } catch (error) {
    console.error('Fehler beim Laden der Empfaengerliste:', error)
    return NextResponse.json(
      { success: false, message: 'Fehler beim Laden der Empfaengerliste' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    await dbConnect()
    const csrf = request.headers.get('x-csrf-intent')
    if (process.env.NODE_ENV === 'production' && csrf !== 'lager:recipient:create') {
      return NextResponse.json({ success: false, message: 'Ungueltige Anforderung' }, { status: 400 })
    }

    const auth = await requireAuth(request, ['lager', 'user', 'admin', 'superadmin'])
    if (!auth.ok) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

    const schema = z.object({
      name: z.string().min(1)
    })

    const parseResult = schema.safeParse(await request.json())
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, message: 'Validierungsfehler', issues: parseResult.error.flatten() },
        { status: 400 }
      )
    }

    const normalizedName = normalizeRecipientName(parseResult.data.name)
    if (!normalizedName) {
      return NextResponse.json({ success: false, message: 'Name darf nicht leer sein' }, { status: 400 })
    }

    const normalizedKey = normalizeRecipientKey(normalizedName)

    const existing = await LagerRecipient.findOne({ normalizedName: normalizedKey }).lean<{ _id?: unknown } | null>()
    if (!existing) {
      try {
        await LagerRecipient.create({
          name: normalizedName,
          normalizedName: normalizedKey,
          active: true
        })
      } catch (error) {
        const mongoError = error as { code?: number }
        if (mongoError?.code !== 11000) throw error
      }
    }

    return NextResponse.json(await buildPayload(), { status: 201 })
  } catch (error) {
    console.error('Fehler beim Speichern des Empfaengers:', error)
    return NextResponse.json(
      { success: false, message: 'Fehler beim Speichern des Empfaengers' },
      { status: 500 }
    )
  }
}