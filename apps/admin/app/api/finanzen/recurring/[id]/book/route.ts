import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/dbConnect'
import FinanceEntry from '@/lib/models/FinanceEntry'
import FinanceRecurringRule from '@/lib/models/FinanceRecurringRule'
import { nextRecurringDate, recurringPeriodKey } from '@/lib/finance-core/calculations'
import { requireFinanceMutation, validObjectId } from '@/lib/finance/apiGuard'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireFinanceMutation(request, 'finance:recurring:book')
  if (denied) return denied
  const { id } = await params
  if (!validObjectId(id)) return NextResponse.json({ success: false, error: 'Ungültige ID.' }, { status: 400 })
  await dbConnect()
  const rule = await FinanceRecurringRule.findById(id)
  if (!rule || !rule.isActive) return NextResponse.json({ success: false, error: 'Aktive Regel nicht gefunden.' }, { status: 404 })
  const body = await request.json().catch(() => ({})) as { periodKey?: string }
  const currentPeriod = recurringPeriodKey(rule.nextDueDate, rule.interval)
  const expectedPeriod = body.periodKey || currentPeriod
  const sourceKey = `recurring:${id}:${expectedPeriod}`
  const existing = await FinanceEntry.findOne({ sourceKey })
  if (existing) return NextResponse.json({ success: true, data: existing, duplicate: true })
  if (expectedPeriod !== currentPeriod) return NextResponse.json({ success: false, error: 'Die Regel wurde zwischenzeitlich fortgeschrieben. Bitte neu laden.' }, { status: 409 })

  const template = rule.entryTemplate as any
  const entry = await FinanceEntry.create({
    ...template,
    source: 'recurring',
    sourceKey,
    recognitionDate: rule.nextDueDate,
    paidAt: template.paymentStatus === 'paid' ? (template.paidAt || rule.nextDueDate) : undefined,
  })
  rule.lastBookedPeriod = currentPeriod
  rule.nextDueDate = nextRecurringDate(rule.nextDueDate, rule.interval)
  await rule.save()
  return NextResponse.json({ success: true, data: entry }, { status: 201 })
}
