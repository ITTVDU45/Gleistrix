import { NextRequest, NextResponse } from 'next/server'
import { requireFinanceMutation } from '@/lib/finance/apiGuard'
import { extractFinanceReceipt } from '@/lib/finance/ai'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const denied = await requireFinanceMutation(request, 'finance:ai-extract')
  if (denied) return denied
  const form = await request.formData()
  const file = form.get('file')
  if (!(file instanceof File)) return NextResponse.json({ success: false, error: 'Belegdatei fehlt.' }, { status: 400 })
  try {
    const result = await extractFinanceReceipt(file)
    return NextResponse.json({ success: true, data: result }, { status: result.configured ? 200 : 503 })
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Beleg konnte nicht analysiert werden.' }, { status: 400 })
  }
}
