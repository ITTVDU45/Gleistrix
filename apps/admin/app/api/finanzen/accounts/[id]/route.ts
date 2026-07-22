import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/dbConnect'
import FinanceAccount from '@/lib/models/FinanceAccount'
import FinanceEntry from '@/lib/models/FinanceEntry'
import { financeAccountSchema, financeValidationError } from '@/lib/finance/validation'
import { financeApiError, requireFinanceMutation, validObjectId } from '@/lib/finance/apiGuard'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireFinanceMutation(request, 'finance:account:update')
  if (denied) return denied
  const { id } = await params
  if (!validObjectId(id)) return NextResponse.json({ success: false, error: 'Ungültige ID.' }, { status: 400 })
  try {
    await dbConnect()
    const parsed = financeAccountSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json(financeValidationError(parsed.error), { status: 400 })
    if (parsed.data.isDefault) await FinanceAccount.updateMany({ _id: { $ne: id } }, { $set: { isDefault: false } })
    const data = await FinanceAccount.findByIdAndUpdate(id, parsed.data, { new: true, runValidators: true })
    if (!data) return NextResponse.json({ success: false, error: 'Konto nicht gefunden.' }, { status: 404 })
    return NextResponse.json({ success: true, data })
  } catch (error) {
    return financeApiError(error, 'Konto konnte nicht aktualisiert werden.')
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireFinanceMutation(request, 'finance:account:delete')
  if (denied) return denied
  const { id } = await params
  if (!validObjectId(id)) return NextResponse.json({ success: false, error: 'Ungültige ID.' }, { status: 400 })
  await dbConnect()
  if (await FinanceEntry.exists({ accountId: id })) return NextResponse.json({ success: false, error: 'Konto wird von Buchungen verwendet und kann nur deaktiviert werden.' }, { status: 409 })
  const data = await FinanceAccount.findByIdAndDelete(id)
  return data ? NextResponse.json({ success: true }) : NextResponse.json({ success: false, error: 'Konto nicht gefunden.' }, { status: 404 })
}
