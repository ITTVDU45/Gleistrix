import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/dbConnect'
import { requireFinanceAccess } from '@/lib/finance/apiGuard'
import { getFinanceOverview } from '@/lib/finance/overview'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const denied = await requireFinanceAccess(request)
  if (denied) return denied
  await dbConnect()
  const now = new Date()
  const fromParam = request.nextUrl.searchParams.get('from')
  const toParam = request.nextUrl.searchParams.get('to')
  // Ohne Zeitraum wird der gesamte Datenbestand geladen; getFinanceOverview meldet
  // anschließend den tatsächlich belegten Zeitraum zurück.
  const autoRange = !fromParam && !toParam
  const from = fromParam ? new Date(`${fromParam}T00:00:00.000Z`) : new Date(Date.UTC(2000, 0, 1))
  const to = toParam ? new Date(`${toParam}T23:59:59.999Z`) : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999))
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
    return NextResponse.json({ success: false, error: 'Ungültiger Zeitraum.' }, { status: 400 })
  }
  try {
    const data = await getFinanceOverview({
      from,
      to,
      autoRange,
      projectId: request.nextUrl.searchParams.get('projectId') || undefined,
      accountId: request.nextUrl.searchParams.get('accountId') || undefined,
    })
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Finanzübersicht konnte nicht geladen werden:', error)
    return NextResponse.json({ success: false, error: 'Finanzübersicht konnte nicht geladen werden.' }, { status: 500 })
  }
}
