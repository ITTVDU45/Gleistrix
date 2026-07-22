import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/dbConnect'
import FinanceAiReport from '@/lib/models/FinanceAiReport'
import { requireFinanceAccess, requireFinanceMutation } from '@/lib/finance/apiGuard'
import { getFinanceOverview } from '@/lib/finance/overview'
import { generateFinanceReport } from '@/lib/finance/ai'

export async function GET(request: NextRequest) {
  const denied = await requireFinanceAccess(request)
  if (denied) return denied
  await dbConnect()
  const data = await FinanceAiReport.find({}).sort({ createdAt: -1 }).limit(30).lean()
  return NextResponse.json({ success: true, data })
}

export async function POST(request: NextRequest) {
  const denied = await requireFinanceMutation(request, 'finance:ai-report')
  if (denied) return denied
  await dbConnect()
  const body = await request.json().catch(() => ({})) as { from?: string; to?: string; projectId?: string }
  const now = new Date()
  const from = body.from ? new Date(`${body.from}T00:00:00.000Z`) : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const to = body.to ? new Date(`${body.to}T23:59:59.999Z`) : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999))
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) return NextResponse.json({ success: false, error: 'Ungültiger Zeitraum.' }, { status: 400 })
  try {
    const overview = await getFinanceOverview({ from, to, projectId: body.projectId })
    const snapshot = {
      period: overview.period,
      kpis: overview.kpis,
      budgets: overview.budgets.map(({ name, basis, limitCents, spentCents, utilizationPercent }) => ({ name, basis, limitCents, spentCents, utilizationPercent })),
      projects: overview.projects.slice(0, 30),
      categoryCosts: overview.categoryCosts,
      warnings: overview.warnings,
    }
    const result = await generateFinanceReport(snapshot)
    if (!result.configured) return NextResponse.json({ success: false, data: result }, { status: 503 })
    const data = await FinanceAiReport.create({ title: result.title, content: result.content, model: result.model, periodFrom: from, periodTo: to, dataSnapshot: snapshot })
    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Bericht konnte nicht erstellt werden.' }, { status: 500 })
  }
}
