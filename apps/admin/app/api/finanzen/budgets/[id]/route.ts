import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/dbConnect'
import FinanceBudget from '@/lib/models/FinanceBudget'
import { financeBudgetSchema, financeValidationError } from '@/lib/finance/validation'
import { financeApiError, optionalObjectId, requireFinanceMutation, validObjectId } from '@/lib/finance/apiGuard'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireFinanceMutation(request, 'finance:budget:update')
  if (denied) return denied
  const { id } = await params
  if (!validObjectId(id)) return NextResponse.json({ success: false, error: 'Ungültige ID.' }, { status: 400 })
  try {
    await dbConnect()
    const parsed = financeBudgetSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json(financeValidationError(parsed.error), { status: 400 })
    const data = await FinanceBudget.findByIdAndUpdate(id, { ...parsed.data, categoryId: optionalObjectId(parsed.data.categoryId), projectId: optionalObjectId(parsed.data.projectId) }, { new: true, runValidators: true })
    return data ? NextResponse.json({ success: true, data }) : NextResponse.json({ success: false, error: 'Budget nicht gefunden.' }, { status: 404 })
  } catch (error) {
    return financeApiError(error, 'Budget konnte nicht aktualisiert werden.')
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireFinanceMutation(request, 'finance:budget:delete')
  if (denied) return denied
  const { id } = await params
  if (!validObjectId(id)) return NextResponse.json({ success: false, error: 'Ungültige ID.' }, { status: 400 })
  await dbConnect()
  const data = await FinanceBudget.findByIdAndDelete(id)
  return data ? NextResponse.json({ success: true }) : NextResponse.json({ success: false, error: 'Budget nicht gefunden.' }, { status: 404 })
}
