import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/dbConnect'
import FinanceCategory from '@/lib/models/FinanceCategory'
import { ensureDefaultFinanceCategories } from '@/lib/finance/defaultCategories'
import { financeCategorySchema, financeValidationError } from '@/lib/finance/validation'
import { financeApiError, requireFinanceAccess, requireFinanceMutation } from '@/lib/finance/apiGuard'

export async function GET(request: NextRequest) {
  const denied = await requireFinanceAccess(request)
  if (denied) return denied
  await dbConnect()
  await ensureDefaultFinanceCategories()
  return NextResponse.json({ success: true, data: await FinanceCategory.find({}).sort({ name: 1 }).lean() })
}

export async function POST(request: NextRequest) {
  const denied = await requireFinanceMutation(request, 'finance:category:create')
  if (denied) return denied
  try {
    await dbConnect()
    const parsed = financeCategorySchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json(financeValidationError(parsed.error), { status: 400 })
    const data = await FinanceCategory.create({ ...parsed.data, isSystem: false })
    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (error) {
    return financeApiError(error, 'Kategorie konnte nicht angelegt werden.')
  }
}
