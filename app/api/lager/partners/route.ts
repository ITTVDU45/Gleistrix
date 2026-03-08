import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { z } from 'zod'
import dbConnect from '@/lib/dbConnect'
import { requireAuth } from '@/lib/security/requireAuth'
import { Employee } from '@/lib/models/Employee'
import { LagerPartner } from '@/lib/models/LagerPartner'
import { LagerRecipient } from '@/lib/models/LagerRecipient'

type PartnerType = 'employee' | 'external'

type PartnerOption = {
  value: string
  label: string
  partnerType: PartnerType
  employeeId?: string
  partnerId?: string
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

function normalizeKey(value: string): string {
  return normalizeText(value).toLocaleLowerCase('de-DE')
}

function buildExternalLabel(companyName: string, contactName: string): string {
  const company = normalizeText(companyName)
  const contact = normalizeText(contactName)
  if (company && contact) return `${company} (${contact})`
  return company || contact
}

async function migrateLegacyRecipientsToPartners(): Promise<void> {
  const names = new Set<string>()

  const legacyListDoc = await LagerRecipient.db
    .collection('lager_recipient_lists')
    .findOne<{ recipients?: string[]; scope?: string }>({ scope: 'global' })

  for (const rawName of legacyListDoc?.recipients ?? []) {
    const normalized = normalizeText(String(rawName ?? ''))
    if (normalized) names.add(normalized)
  }

  const recipientDocs = await LagerRecipient.find({ active: true }).select({ name: 1 }).lean<Array<{ name?: string }>>()
  for (const entry of recipientDocs) {
    const normalized = normalizeText(String(entry.name ?? ''))
    if (normalized) names.add(normalized)
  }

  if (names.size === 0) return

  const operations = Array.from(names).map((name) => ({
    updateOne: {
      filter: { normalizedKey: `legacy:${normalizeKey(name)}` },
      update: {
        $setOnInsert: {
          type: 'external',
          companyName: name,
          contactName: '',
          phone: '',
          email: '',
          active: true,
          normalizedKey: `legacy:${normalizeKey(name)}`
        }
      },
      upsert: true
    }
  }))

  if (operations.length > 0) {
    await LagerPartner.bulkWrite(operations, { ordered: false })
  }
}

async function buildPayload() {
  await migrateLegacyRecipientsToPartners()

  const [employees, partners] = await Promise.all([
    Employee.find({})
      .sort({ name: 1 })
      .select({ _id: 1, name: 1 })
      .lean<Array<{ _id?: unknown; name?: string }>>(),
    LagerPartner.find({})
      .sort({ createdAt: -1 })
      .populate('employeeId', 'name')
      .lean<Array<{
        _id?: unknown
        type?: PartnerType
        employeeId?: { _id?: unknown; name?: string } | string
        companyName?: string
        contactName?: string
        phone?: string
        email?: string
        active?: boolean
      }>>()
  ])

  const employeeOptions: PartnerOption[] = employees.reduce<PartnerOption[]>((acc, employee) => {
    const employeeId = String(employee._id ?? '').trim()
    const name = normalizeText(String(employee.name ?? ''))
    if (!employeeId || !name) return acc

    acc.push({
      value: `employee:${employeeId}`,
      label: name,
      partnerType: 'employee',
      employeeId
    })

    return acc
  }, [])

  const supplierOptions: PartnerOption[] = partners
    .filter((partner) => partner.type === 'external' && partner.active !== false)
    .reduce<PartnerOption[]>((acc, partner) => {
      const partnerId = String(partner._id ?? '').trim()
      const label = buildExternalLabel(String(partner.companyName ?? ''), String(partner.contactName ?? ''))
      if (!partnerId || !label) return acc

      acc.push({
        value: `partner:${partnerId}`,
        label,
        partnerType: 'external',
        partnerId
      })
      return acc
    }, [])
    .sort((a, b) => a.label.localeCompare(b.label, 'de', { sensitivity: 'base' }))

  const partnerList = partners.map((partner) => {
    const id = String(partner._id ?? '')
    const type = (partner.type ?? 'external') as PartnerType
    const employeeRef = typeof partner.employeeId === 'object' ? partner.employeeId : null
    const employeeId = String(employeeRef?._id ?? '') || undefined
    const employeeName = normalizeText(String(employeeRef?.name ?? ''))
    const companyName = normalizeText(String(partner.companyName ?? ''))
    const contactName = normalizeText(String(partner.contactName ?? ''))
    const label = type === 'employee'
      ? (employeeName || contactName || 'Mitarbeiter')
      : buildExternalLabel(companyName, contactName)

    return {
      id,
      type,
      label,
      employeeId,
      employeeName,
      companyName,
      contactName,
      phone: normalizeText(String(partner.phone ?? '')),
      email: normalizeText(String(partner.email ?? '')),
      active: partner.active !== false
    }
  })

  return {
    success: true,
    employees: employeeOptions,
    suppliers: supplierOptions,
    partners: partnerList
  }
}

export async function GET(request: NextRequest) {
  try {
    await dbConnect()
    const auth = await requireAuth(request, ['lager', 'user', 'admin', 'superadmin'])
    if (!auth.ok) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

    return NextResponse.json(await buildPayload())
  } catch (error) {
    console.error('Fehler beim Laden der Partnerliste:', error)
    return NextResponse.json({ success: false, message: 'Fehler beim Laden der Partnerliste' }, { status: 500 })
  }
}

const createSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('employee'),
    employeeId: z.string().min(1),
    contactName: z.string().optional().default(''),
    phone: z.string().optional().default(''),
    email: z.string().optional().default('')
  }),
  z.object({
    type: z.literal('external'),
    companyName: z.string().min(1),
    contactName: z.string().min(1),
    phone: z.string().optional().default(''),
    email: z.string().optional().default('')
  })
])

export async function POST(request: NextRequest) {
  try {
    await dbConnect()
    const csrf = request.headers.get('x-csrf-intent')
    if (process.env.NODE_ENV === 'production' && csrf !== 'lager:partner:create') {
      return NextResponse.json({ success: false, message: 'Ungueltige Anforderung' }, { status: 400 })
    }

    const auth = await requireAuth(request, ['lager', 'user', 'admin', 'superadmin'])
    if (!auth.ok) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

    const parseResult = createSchema.safeParse(await request.json())
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, message: 'Validierungsfehler', issues: parseResult.error.flatten() },
        { status: 400 }
      )
    }

    const body = parseResult.data

    if (body.type === 'employee') {
      if (!mongoose.Types.ObjectId.isValid(body.employeeId)) {
        return NextResponse.json({ success: false, message: 'Ungueltige Mitarbeiter-ID' }, { status: 400 })
      }

      const employee = await Employee.findById(body.employeeId).select({ _id: 1, name: 1 }).lean<{ _id?: unknown; name?: string } | null>()
      if (!employee) {
        return NextResponse.json({ success: false, message: 'Mitarbeiter nicht gefunden' }, { status: 404 })
      }

      const normalizedKey = `employee:${String(employee._id)}`
      await LagerPartner.findOneAndUpdate(
        { normalizedKey },
        {
          $set: {
            type: 'employee',
            employeeId: employee._id,
            companyName: '',
            contactName: normalizeText(body.contactName || String(employee.name ?? '')),
            phone: normalizeText(body.phone ?? ''),
            email: normalizeText(body.email ?? ''),
            active: true,
            normalizedKey
          }
        },
        { upsert: true, new: true }
      )
    } else {
      const companyName = normalizeText(body.companyName)
      const contactName = normalizeText(body.contactName)
      const phone = normalizeText(body.phone ?? '')
      const email = normalizeText(body.email ?? '')

      if (!companyName || !contactName) {
        return NextResponse.json({ success: false, message: 'Firma und Ansprechpartner sind erforderlich' }, { status: 400 })
      }
      if (!phone && !email) {
        return NextResponse.json({ success: false, message: 'Bitte Telefon oder E-Mail angeben' }, { status: 400 })
      }

      const normalizedKey = `external:${normalizeKey(`${companyName}|${contactName}`)}`
      const existingSupplier = await LagerPartner.findOne({ normalizedKey }).lean<{ _id?: unknown } | null>()
      if (!existingSupplier) {
        const supplierCount = await LagerPartner.countDocuments({ type: 'external' })
        if (supplierCount >= 5) {
          return NextResponse.json(
            { success: false, message: 'Maximal 5 Firmen-Lieferanten sind erlaubt' },
            { status: 400 }
          )
        }
      }

      await LagerPartner.findOneAndUpdate(
        { normalizedKey },
        {
          $set: {
            type: 'external',
            employeeId: null,
            companyName,
            contactName,
            phone,
            email,
            active: true,
            normalizedKey
          }
        },
        { upsert: true, new: true }
      )
    }

    return NextResponse.json(await buildPayload(), { status: 201 })
  } catch (error) {
    console.error('Fehler beim Speichern des Partners:', error)
    return NextResponse.json({ success: false, message: 'Fehler beim Speichern des Partners' }, { status: 500 })
  }
}

