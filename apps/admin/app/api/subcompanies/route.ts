import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import dbConnect from '@/lib/dbConnect'
import { Subcompany } from '@/lib/models/Subcompany'
import { requireAuth } from '@/lib/security/requireAuth'

export async function GET(request: NextRequest) {
  try {
    await dbConnect()
    // Subunternehmen-Rolle darf die Gesamtliste (inkl. Bankdaten/Preise) nicht sehen
    const auth = await requireAuth(request, ['user', 'admin', 'superadmin'])
    if (!auth.ok) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })
    }
    const subcompanies = await Subcompany.find({}).sort({ name: 1 })
    return NextResponse.json({ success: true, subcompanies })
  } catch (error) {
    logger.error('Fehler beim Laden der Subunternehmen:', error)
    return NextResponse.json(
      { success: false, message: 'Fehler beim Laden der Subunternehmen' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    await dbConnect()
    const auth = await requireAuth(request, ['user', 'admin', 'superadmin'])
    if (!auth.ok) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })
    }

    const schema = z.object({
      name: z.string().min(1),
      employeeCount: z.number().int().min(1),
      address: z.string().optional().or(z.literal('')),
      phone: z.string().optional().or(z.literal('')),
      email: z.string().optional().or(z.literal('')),
      bankAccount: z.string().optional().or(z.literal('')),
      notes: z.string().optional().or(z.literal('')),
      functionRates: z
        .array(
          z.object({
            funktion: z.string().min(1).max(100),
            hourlyRate: z.number().min(0).max(100000),
          })
        )
        .max(100)
        .optional(),
      surchargeRates: z
        .object({
          nachtProzent: z.number().min(0).max(1000).optional(),
          sonntagProzent: z.number().min(0).max(1000).optional(),
          feiertagProzent: z.number().min(0).max(1000).optional(),
        })
        .optional(),
    })
    const parsed = schema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: 'Validierungsfehler', issues: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const subcompany = await Subcompany.create({
      name: parsed.data.name,
      employeeCount: parsed.data.employeeCount,
      address: parsed.data.address || '',
      phone: parsed.data.phone || '',
      email: parsed.data.email || '',
      bankAccount: parsed.data.bankAccount || '',
      notes: parsed.data.notes || '',
      ...(parsed.data.functionRates ? { functionRates: parsed.data.functionRates } : {}),
      ...(parsed.data.surchargeRates ? { surchargeRates: parsed.data.surchargeRates } : {}),
    })

    return NextResponse.json({ success: true, subcompany }, { status: 201 })
  } catch (error) {
    logger.error('Fehler beim Erstellen des Subunternehmens:', error)
    return NextResponse.json(
      { success: false, message: 'Fehler beim Erstellen des Subunternehmens' },
      { status: 500 }
    )
  }
}
