import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/dbConnect'
import FinanceCategory from '@/lib/models/FinanceCategory'
import FinanceEntry from '@/lib/models/FinanceEntry'
import { financeCategorySchema, financeValidationError } from '@/lib/finance/validation'
import { financeApiError, requireFinanceMutation, validObjectId } from '@/lib/finance/apiGuard'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireFinanceMutation(request, 'finance:category:update')
  if (denied) return denied
  const { id } = await params
  if (!validObjectId(id)) return NextResponse.json({ success: false, error: 'Ungültige ID.' }, { status: 400 })
  try {
    await dbConnect()
    const current = await FinanceCategory.findById(id).lean() as { isSystem: boolean; slug: string } | null
    if (!current) return NextResponse.json({ success: false, error: 'Kategorie nicht gefunden.' }, { status: 404 })
    const parsed = financeCategorySchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json(financeValidationError(parsed.error), { status: 400 })
    const update = current.isSystem ? { ...parsed.data, slug: current.slug } : parsed.data
    const data = await FinanceCategory.findByIdAndUpdate(id, update, { new: true, runValidators: true })
    return NextResponse.json({ success: true, data })
  } catch (error) {
    return financeApiError(error, 'Kategorie konnte nicht aktualisiert werden.')
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireFinanceMutation(request, 'finance:category:delete')
  if (denied) return denied
  const { id } = await params
  if (!validObjectId(id)) return NextResponse.json({ success: false, error: 'Ungültige ID.' }, { status: 400 })
  await dbConnect()
  const current = await FinanceCategory.findById(id).lean() as { isSystem: boolean } | null
  if (!current) return NextResponse.json({ success: false, error: 'Kategorie nicht gefunden.' }, { status: 404 })
  if (current.isSystem || await FinanceEntry.exists({ categoryId: id })) {
    await FinanceCategory.updateOne({ _id: id }, { $set: { isActive: false } })
    return NextResponse.json({ success: true, deactivated: true })
  }
  await FinanceCategory.deleteOne({ _id: id })
  return NextResponse.json({ success: true })
}
