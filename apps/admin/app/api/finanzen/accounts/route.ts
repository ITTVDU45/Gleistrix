import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/dbConnect'
import FinanceAccount from '@/lib/models/FinanceAccount'
import { financeAccountSchema, financeValidationError } from '@/lib/finance/validation'
import { financeApiError, requireFinanceAccess, requireFinanceMutation } from '@/lib/finance/apiGuard'

export async function GET(request: NextRequest) {
  const denied = await requireFinanceAccess(request)
  if (denied) return denied
  await dbConnect()
  return NextResponse.json({ success: true, data: await FinanceAccount.find({}).sort({ isDefault: -1, name: 1 }).lean() })
}

export async function POST(request: NextRequest) {
  const denied = await requireFinanceMutation(request, 'finance:account:create')
  if (denied) return denied
  try {
    await dbConnect()
    const parsed = financeAccountSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json(financeValidationError(parsed.error), { status: 400 })
    if (parsed.data.isDefault) await FinanceAccount.updateMany({}, { $set: { isDefault: false } })
    const data = await FinanceAccount.create(parsed.data)
    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (error) {
    return financeApiError(error, 'Konto konnte nicht angelegt werden.')
  }
}
