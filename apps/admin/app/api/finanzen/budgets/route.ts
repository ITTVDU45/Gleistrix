import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/dbConnect'
import FinanceBudget from '@/lib/models/FinanceBudget'
import { financeBudgetSchema, financeValidationError } from '@/lib/finance/validation'
import { financeApiError, optionalObjectId, requireFinanceAccess, requireFinanceMutation } from '@/lib/finance/apiGuard'

export async function GET(request: NextRequest) {
  const denied = await requireFinanceAccess(request)
  if (denied) return denied
  await dbConnect()
  return NextResponse.json({ success: true, data: await FinanceBudget.find({}).sort({ year: -1, month: -1 }).lean() })
}

export async function POST(request: NextRequest) {
  const denied = await requireFinanceMutation(request, 'finance:budget:create')
  if (denied) return denied
  try {
    await dbConnect()
    const parsed = financeBudgetSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json(financeValidationError(parsed.error), { status: 400 })
    const data = await FinanceBudget.create({ ...parsed.data, categoryId: optionalObjectId(parsed.data.categoryId), projectId: optionalObjectId(parsed.data.projectId) })
    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (error) {
    return financeApiError(error, 'Budget konnte nicht angelegt werden.')
  }
}
