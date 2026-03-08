import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { z } from 'zod'
import dbConnect from '@/lib/dbConnect'
import { requireAuth } from '@/lib/security/requireAuth'
import { Employee } from '@/lib/models/Employee'
import { LagerPartner } from '@/lib/models/LagerPartner'

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

function normalizeKey(value: string): string {
  return normalizeText(value).toLocaleLowerCase('de-DE')
}

const updateSchema = z.object({
  type: z.enum(['employee', 'external']).optional(),
  employeeId: z.string().optional(),
  companyName: z.string().optional(),
  contactName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  active: z.boolean().optional()
})

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await dbConnect()

    const csrf = request.headers.get('x-csrf-intent')
    if (process.env.NODE_ENV === 'production' && csrf !== 'lager:partner:update') {
      return NextResponse.json({ success: false, message: 'Ungueltige Anforderung' }, { status: 400 })
    }

    const auth = await requireAuth(request, ['lager', 'user', 'admin', 'superadmin'])
    if (!auth.ok) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

    const { id } = await context.params
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, message: 'Ungueltige Partner-ID' }, { status: 400 })
    }

    const parseResult = updateSchema.safeParse(await request.json())
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, message: 'Validierungsfehler', issues: parseResult.error.flatten() },
        { status: 400 }
      )
    }

    const body = parseResult.data
    const existing = await LagerPartner.findById(id)
    if (!existing) {
      return NextResponse.json({ success: false, message: 'Partner nicht gefunden' }, { status: 404 })
    }

    const nextType = body.type ?? existing.type
    const nextActive = typeof body.active === 'boolean' ? body.active : existing.active !== false

    if (nextType === 'employee') {
      const employeeIdRaw = body.employeeId ?? (existing.employeeId ? String(existing.employeeId) : '')
      if (!employeeIdRaw || !mongoose.Types.ObjectId.isValid(employeeIdRaw)) {
        return NextResponse.json({ success: false, message: 'Mitarbeiter ist erforderlich' }, { status: 400 })
      }

      const employee = await Employee.findById(employeeIdRaw).select({ _id: 1, name: 1 }).lean<{ _id?: unknown; name?: string } | null>()
      if (!employee) {
        return NextResponse.json({ success: false, message: 'Mitarbeiter nicht gefunden' }, { status: 404 })
      }

      const normalizedKey = `employee:${String(employee._id)}`
      const duplicate = await LagerPartner.findOne({ normalizedKey, _id: { $ne: existing._id } }).lean<{ _id?: unknown } | null>()
      if (duplicate) {
        return NextResponse.json({ success: false, message: 'Dieser Mitarbeiter ist bereits als Partner vorhanden' }, { status: 409 })
      }

      existing.type = 'employee'
      existing.employeeId = new mongoose.Types.ObjectId(String(employee._id))
      existing.companyName = ''
      existing.contactName = normalizeText(body.contactName ?? existing.contactName ?? String(employee.name ?? ''))
      existing.phone = normalizeText(body.phone ?? existing.phone ?? '')
      existing.email = normalizeText(body.email ?? existing.email ?? '')
      existing.active = nextActive
      existing.normalizedKey = normalizedKey
      await existing.save()
    } else {
      const companyName = normalizeText(body.companyName ?? existing.companyName ?? '')
      const contactName = normalizeText(body.contactName ?? existing.contactName ?? '')
      const phone = normalizeText(body.phone ?? existing.phone ?? '')
      const email = normalizeText(body.email ?? existing.email ?? '')

      if (!companyName || !contactName) {
        return NextResponse.json({ success: false, message: 'Firma und Ansprechpartner sind erforderlich' }, { status: 400 })
      }
      if (!phone && !email) {
        return NextResponse.json({ success: false, message: 'Bitte Telefon oder E-Mail angeben' }, { status: 400 })
      }

      const normalizedKey = `external:${normalizeKey(`${companyName}|${contactName}`)}`
      const duplicate = await LagerPartner.findOne({ normalizedKey, _id: { $ne: existing._id } }).lean<{ _id?: unknown } | null>()
      if (duplicate) {
        return NextResponse.json({ success: false, message: 'Dieser Lieferant ist bereits vorhanden' }, { status: 409 })
      }

      existing.type = 'external'
      existing.employeeId = undefined
      existing.companyName = companyName
      existing.contactName = contactName
      existing.phone = phone
      existing.email = email
      existing.active = nextActive
      existing.normalizedKey = normalizedKey
      await existing.save()
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Fehler beim Aktualisieren des Partners:', error)
    return NextResponse.json({ success: false, message: 'Fehler beim Aktualisieren des Partners' }, { status: 500 })
  }
}
