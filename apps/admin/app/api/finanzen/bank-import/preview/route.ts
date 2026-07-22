import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/dbConnect'
import FinanceAccount from '@/lib/models/FinanceAccount'
import FinanceEntry from '@/lib/models/FinanceEntry'
import { parseBankCsv } from '@/lib/finance-core/bankCsv'
import { requireFinanceAccess } from '@/lib/finance/apiGuard'

export async function POST(request: NextRequest) {
  const denied = await requireFinanceAccess(request)
  if (denied) return denied
  await dbConnect()
  const body = await request.json().catch(() => ({})) as { csv?: string; accountId?: string }
  if (!body.csv || body.csv.length > 5_000_000) return NextResponse.json({ success: false, error: 'CSV fehlt oder ist zu groß.' }, { status: 400 })
  if (!body.accountId || !await FinanceAccount.exists({ _id: body.accountId, isActive: true })) return NextResponse.json({ success: false, error: 'Aktives Konto nicht gefunden.' }, { status: 404 })
  try {
    const rows = parseBankCsv(body.csv)
    const fingerprints = rows.map(row => row.fingerprint)
    const existingImports = await FinanceEntry.find({ importFingerprint: { $in: fingerprints } }).select('importFingerprint').lean()
    const duplicates = new Set(existingImports.map((entry: any) => entry.importFingerprint))
    const minDate = rows.length ? new Date(`${rows.map(row => row.bookingDate).sort()[0]}T00:00:00.000Z`) : new Date()
    const maxDate = rows.length ? new Date(`${rows.map(row => row.bookingDate).sort().at(-1)}T23:59:59.999Z`) : new Date()
    const candidates = await FinanceEntry.find({
      recognitionDate: { $gte: minDate, $lte: maxDate },
      source: { $ne: 'bank_csv' },
    }).select('direction grossCents recognitionDate reference title').lean()
    const result = rows.map(row => {
      const suggested = candidates.find((entry: any) => {
        const signedAmount = entry.direction === 'income' ? entry.grossCents : -entry.grossCents
        const date = new Date(entry.recognitionDate).toISOString().slice(0, 10)
        const referenceMatch = !entry.reference || row.reference.toLocaleLowerCase('de').includes(String(entry.reference).toLocaleLowerCase('de'))
        return signedAmount === row.amountCents && Math.abs(new Date(date).getTime() - new Date(row.bookingDate).getTime()) <= 3 * 86_400_000 && referenceMatch
      })
      return { ...row, duplicate: duplicates.has(row.fingerprint), suggestedMatch: suggested ? { id: String(suggested._id), title: suggested.title } : undefined }
    })
    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'CSV konnte nicht gelesen werden.' }, { status: 400 })
  }
}
