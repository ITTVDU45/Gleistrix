import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/dbConnect'
import EmployeeFinanceRate from '@/lib/models/EmployeeFinanceRate'
import { employeeFinanceRateSchema, financeValidationError } from '@/lib/finance/validation'
import { financeApiError, requireFinanceMutation, validObjectId } from '@/lib/finance/apiGuard'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireFinanceMutation(request, 'finance:rate:update')
  if (denied) return denied
  const { id } = await params
  if (!validObjectId(id)) return NextResponse.json({ success: false, error: 'Ungültige ID.' }, { status: 400 })
  try {
    await dbConnect()
    const parsed = employeeFinanceRateSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json(financeValidationError(parsed.error), { status: 400 })
    const data = await EmployeeFinanceRate.findByIdAndUpdate(id, parsed.data, { new: true, runValidators: true })
    return data ? NextResponse.json({ success: true, data }) : NextResponse.json({ success: false, error: 'Lohnsatz nicht gefunden.' }, { status: 404 })
  } catch (error) {
    return financeApiError(error, 'Lohnsatz konnte nicht aktualisiert werden.')
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireFinanceMutation(request, 'finance:rate:delete')
  if (denied) return denied
  const { id } = await params
  if (!validObjectId(id)) return NextResponse.json({ success: false, error: 'Ungültige ID.' }, { status: 400 })
  await dbConnect()
  const data = await EmployeeFinanceRate.findByIdAndDelete(id)
  return data ? NextResponse.json({ success: true }) : NextResponse.json({ success: false, error: 'Lohnsatz nicht gefunden.' }, { status: 404 })
}
