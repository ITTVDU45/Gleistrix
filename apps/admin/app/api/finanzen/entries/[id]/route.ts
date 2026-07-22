import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/dbConnect'
import FinanceEntry from '@/lib/models/FinanceEntry'
import { requireFinanceMutation, financeApiError, optionalObjectId, validObjectId } from '@/lib/finance/apiGuard'
import { financeEntrySchema, financeValidationError } from '@/lib/finance/validation'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireFinanceMutation(request, 'finance:entry:update')
  if (denied) return denied
  const { id } = await params
  if (!validObjectId(id)) return NextResponse.json({ success: false, error: 'Ungültige ID.' }, { status: 400 })
  try {
    await dbConnect()
    const existing = await FinanceEntry.findById(id).lean() as { source: string } | null
    if (!existing) return NextResponse.json({ success: false, error: 'Buchung nicht gefunden.' }, { status: 404 })
    if (!['manual', 'ai_receipt', 'adjustment'].includes(existing.source)) return NextResponse.json({ success: false, error: 'Automatische Buchungen sind schreibgeschützt.' }, { status: 409 })
    const parsed = financeEntrySchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json(financeValidationError(parsed.error), { status: 400 })
    const value = parsed.data
    const entry = await FinanceEntry.findByIdAndUpdate(id, {
      ...value,
      categoryId: optionalObjectId(value.categoryId), accountId: optionalObjectId(value.accountId), projectId: optionalObjectId(value.projectId),
      employeeId: optionalObjectId(value.employeeId), subcompanyId: optionalObjectId(value.subcompanyId),
      receivedInvoiceId: optionalObjectId(value.receivedInvoiceId), vehicleId: optionalObjectId(value.vehicleId), materialId: optionalObjectId(value.materialId),
      dueDate: value.dueDate || undefined, paidAt: value.paidAt || undefined,
    }, { new: true, runValidators: true })
    return NextResponse.json({ success: true, data: entry })
  } catch (error) {
    return financeApiError(error, 'Buchung konnte nicht aktualisiert werden.')
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireFinanceMutation(request, 'finance:entry:delete')
  if (denied) return denied
  const { id } = await params
  if (!validObjectId(id)) return NextResponse.json({ success: false, error: 'Ungültige ID.' }, { status: 400 })
  await dbConnect()
  const entry = await FinanceEntry.findById(id).lean() as { source: string } | null
  if (!entry) return NextResponse.json({ success: false, error: 'Buchung nicht gefunden.' }, { status: 404 })
  if (!['manual', 'ai_receipt', 'adjustment', 'recurring', 'bank_csv'].includes(entry.source)) return NextResponse.json({ success: false, error: 'Automatische Buchungen sind schreibgeschützt.' }, { status: 409 })
  await FinanceEntry.deleteOne({ _id: id })
  return NextResponse.json({ success: true })
}
