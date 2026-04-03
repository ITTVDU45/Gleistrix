import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import dbConnect from '../../../../lib/dbConnect'
import { Subcompany } from '../../../../lib/models/Subcompany'
import { requireAuth } from '../../../../lib/security/requireAuth'

export async function PUT(request: NextRequest) {
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
    })
    const parsed = schema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: 'Validierungsfehler', issues: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const url = new URL(request.url)
    const parts = url.pathname.split('/').filter(Boolean)
    const idx = parts.indexOf('subcompanies')
    const id = idx >= 0 && parts.length > idx + 1 ? parts[idx + 1] : undefined
    if (!id) {
      return NextResponse.json({ success: false, message: 'Ungueltige ID' }, { status: 400 })
    }

    const subcompany = await Subcompany.findByIdAndUpdate(
      id,
      {
        name: parsed.data.name,
        employeeCount: parsed.data.employeeCount,
        address: parsed.data.address || '',
        phone: parsed.data.phone || '',
        email: parsed.data.email || '',
        bankAccount: parsed.data.bankAccount || '',
        notes: parsed.data.notes || '',
      },
      { new: true }
    )

    if (!subcompany) {
      return NextResponse.json({ success: false, message: 'Subunternehmen nicht gefunden' }, { status: 404 })
    }

    return NextResponse.json({ success: true, subcompany })
  } catch (error) {
    console.error('Fehler beim Aktualisieren des Subunternehmens:', error)
    return NextResponse.json(
      { success: false, message: 'Fehler beim Aktualisieren des Subunternehmens' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await dbConnect()
    const auth = await requireAuth(request, ['user', 'admin', 'superadmin'])
    if (!auth.ok) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })
    }

    const url = new URL(request.url)
    const parts = url.pathname.split('/').filter(Boolean)
    const idx = parts.indexOf('subcompanies')
    const id = idx >= 0 && parts.length > idx + 1 ? parts[idx + 1] : undefined
    if (!id) {
      return NextResponse.json({ success: false, message: 'Ungueltige ID' }, { status: 400 })
    }

    const deleted = await Subcompany.findByIdAndDelete(id)
    if (!deleted) {
      return NextResponse.json({ success: false, message: 'Subunternehmen nicht gefunden' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Fehler beim Loeschen des Subunternehmens:', error)
    return NextResponse.json(
      { success: false, message: 'Fehler beim Loeschen des Subunternehmens' },
      { status: 500 }
    )
  }
}
