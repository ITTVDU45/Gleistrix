import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/dbConnect'
import FinanceEntry from '@/lib/models/FinanceEntry'
import { requireFinanceAccess, requireFinanceMutation, financeApiError, optionalObjectId } from '@/lib/finance/apiGuard'
import { financeEntrySchema, financeValidationError } from '@/lib/finance/validation'

export async function GET(request: NextRequest) {
  const denied = await requireFinanceAccess(request)
  if (denied) return denied
  await dbConnect()
  const entries = await FinanceEntry.find({}).sort({ recognitionDate: -1 }).limit(1000).lean()
  return NextResponse.json({ success: true, data: entries })
}

export async function POST(request: NextRequest) {
  const denied = await requireFinanceMutation(request, 'finance:entry:create')
  if (denied) return denied
  try {
    await dbConnect()
    const parsed = financeEntrySchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json(financeValidationError(parsed.error), { status: 400 })
    const value = parsed.data
    const entry = await FinanceEntry.create({
      ...value,
      categoryId: optionalObjectId(value.categoryId), accountId: optionalObjectId(value.accountId),
      projectId: optionalObjectId(value.projectId), employeeId: optionalObjectId(value.employeeId),
      subcompanyId: optionalObjectId(value.subcompanyId), receivedInvoiceId: optionalObjectId(value.receivedInvoiceId),
      vehicleId: optionalObjectId(value.vehicleId), materialId: optionalObjectId(value.materialId),
      dueDate: value.dueDate || undefined, paidAt: value.paidAt || undefined,
    })
    return NextResponse.json({ success: true, data: entry }, { status: 201 })
  } catch (error) {
    return financeApiError(error, 'Buchung konnte nicht angelegt werden.')
  }
}
