import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/dbConnect'
import FinanceRecurringRule from '@/lib/models/FinanceRecurringRule'
import { financeRecurringSchema, financeValidationError } from '@/lib/finance/validation'
import { financeApiError, requireFinanceAccess, requireFinanceMutation } from '@/lib/finance/apiGuard'

export async function GET(request: NextRequest) {
  const denied = await requireFinanceAccess(request)
  if (denied) return denied
  await dbConnect()
  return NextResponse.json({ success: true, data: await FinanceRecurringRule.find({}).sort({ nextDueDate: 1 }).lean() })
}

export async function POST(request: NextRequest) {
  const denied = await requireFinanceMutation(request, 'finance:recurring:create')
  if (denied) return denied
  try {
    await dbConnect()
    const parsed = financeRecurringSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json(financeValidationError(parsed.error), { status: 400 })
    const data = await FinanceRecurringRule.create(parsed.data)
    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (error) {
    return financeApiError(error, 'Wiederkehrende Buchung konnte nicht angelegt werden.')
  }
}
