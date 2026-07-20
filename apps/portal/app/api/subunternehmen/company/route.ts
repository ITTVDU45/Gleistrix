import { NextRequest, NextResponse } from 'next/server'
import { hasValidCsrfIntent } from '@/lib/security/requireCsrfIntent'
import { z } from 'zod'
import dbConnect from '@/lib/dbConnect'
import { requireSubcontractor } from '@/lib/subunternehmen/access'
import { Subcompany } from '@/lib/models/Subcompany'
import {
  serializeCompanyForPortal,
  missingCompanyFieldsForInvoicing,
} from '@/lib/subunternehmen/queries'
import { logSubcontractorActivity } from '@/lib/subunternehmen/audit'
import { logger } from '@/lib/logger'

/** Eigene Unternehmensdaten einsehen. */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireSubcontractor(req)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
    return NextResponse.json({
      success: true,
      company: serializeCompanyForPortal(auth.ctx.company),
      missingForInvoicing: missingCompanyFieldsForInvoicing(auth.ctx.company),
      membershipRole: auth.ctx.role,
      permissions: auth.ctx.permissions,
    })
  } catch (error) {
    logger.error('Portal: Unternehmensdaten konnten nicht geladen werden', error)
    return NextResponse.json({ error: 'Fehler beim Laden der Unternehmensdaten' }, { status: 500 })
  }
}

const updateSchema = z.object({
  legalName: z.string().max(200).optional(),
  billingAddress: z
    .object({
      street: z.string().max(200).optional(),
      postalCode: z.string().max(20).optional(),
      city: z.string().max(100).optional(),
      country: z.string().max(100).optional(),
    })
    .optional(),
  contactName: z.string().max(200).optional(),
  contactEmail: z.string().email().optional().or(z.literal('')),
  contactPhone: z.string().max(50).optional(),
  taxNumber: z.string().max(50).optional(),
  vatId: z.string().max(50).optional(),
  iban: z.string().max(42).optional(),
  bic: z.string().max(20).optional(),
  bankName: z.string().max(100).optional(),
  defaultPaymentTermDays: z.number().int().min(0).max(365).optional(),
  defaultVatRate: z.number().min(0).max(100).optional(),
  invoiceNumberPrefix: z.string().max(12).optional(),
})

/**
 * Freigegebene Unternehmensdaten aktualisieren (nur eigene Firma, nur mit
 * Permission). Interne Felder (name, employeeCount, status, notes) sind
 * bewusst NICHT änderbar.
 */
export async function PUT(req: NextRequest) {
  try {
    const auth = await requireSubcontractor(req, 'subcontractor.company.update')
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
    if (!hasValidCsrfIntent(req, 'sub:company-update')) {
      return NextResponse.json({ error: 'Ungültige Anforderung' }, { status: 400 })
    }

    await dbConnect()
    const parsed = updateSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validierungsfehler', issues: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { ctx } = auth
    const before = serializeCompanyForPortal(ctx.company)

    const update: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(parsed.data)) {
      if (value !== undefined) update[key] = value
    }

    const updated = await Subcompany.findByIdAndUpdate(
      ctx.companyId,
      { $set: update },
      { new: true, runValidators: true }
    ).lean() as Record<string, any> | null
    if (!updated) {
      return NextResponse.json({ error: 'Subunternehmen nicht gefunden' }, { status: 404 })
    }

    await logSubcontractorActivity({
      actionType: 'settings_updated',
      description: `Unternehmensprofil aktualisiert: ${ctx.companyName}`,
      userId: ctx.userId,
      userName: ctx.userName,
      userRole: 'subunternehmen',
      entityId: ctx.companyId,
      subcontractorCompanyId: ctx.companyId,
      before,
      after: serializeCompanyForPortal(updated),
    })

    return NextResponse.json({
      success: true,
      company: serializeCompanyForPortal(updated),
      missingForInvoicing: missingCompanyFieldsForInvoicing(updated),
    })
  } catch (error) {
    logger.error('Portal: Unternehmensdaten konnten nicht gespeichert werden', error)
    return NextResponse.json({ error: 'Fehler beim Speichern der Unternehmensdaten' }, { status: 500 })
  }
}
