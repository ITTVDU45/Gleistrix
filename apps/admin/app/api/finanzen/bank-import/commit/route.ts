import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/dbConnect'
import FinanceAccount from '@/lib/models/FinanceAccount'
import FinanceEntry from '@/lib/models/FinanceEntry'
import { parseBankCsv } from '@/lib/finance-core/bankCsv'
import { requireFinanceMutation } from '@/lib/finance/apiGuard'

export async function POST(request: NextRequest) {
  const denied = await requireFinanceMutation(request, 'finance:bank-import')
  if (denied) return denied
  await dbConnect()
  const body = await request.json().catch(() => ({})) as {
    csv?: string
    accountId?: string
    decisions?: Array<{ fingerprint: string; action: 'import' | 'match' | 'skip'; matchEntryId?: string }>
  }
  if (!body.csv || body.csv.length > 5_000_000) return NextResponse.json({ success: false, error: 'CSV fehlt oder ist zu groß.' }, { status: 400 })
  if (!body.accountId || !await FinanceAccount.exists({ _id: body.accountId, isActive: true })) return NextResponse.json({ success: false, error: 'Aktives Konto nicht gefunden.' }, { status: 404 })
  try {
    const rows = parseBankCsv(body.csv)
    const decisions = new Map((body.decisions || []).map(decision => [decision.fingerprint, decision]))
    let imported = 0
    let matched = 0
    let skipped = 0
    for (const row of rows) {
      const decision = decisions.get(row.fingerprint)
      if (!decision || decision.action === 'skip') { skipped += 1; continue }
      if (decision.action === 'match') {
        if (!decision.matchEntryId) { skipped += 1; continue }
        const result = await FinanceEntry.updateOne(
          { _id: decision.matchEntryId, importFingerprint: { $exists: false } },
          { $set: { accountId: body.accountId, paidAt: new Date(`${row.bookingDate}T12:00:00.000Z`), paymentStatus: 'paid', importFingerprint: row.fingerprint } }
        )
        if (result.modifiedCount) matched += 1
        else skipped += 1
        continue
      }
      const amount = Math.abs(row.amountCents)
      const result = await FinanceEntry.updateOne(
        { sourceKey: `bank_csv:${row.fingerprint}` },
        { $setOnInsert: {
          direction: row.amountCents >= 0 ? 'income' : 'expense', title: row.counterparty || row.reference || 'Bankbuchung',
          description: row.reference, reference: row.reference, recognitionDate: new Date(`${row.bookingDate}T12:00:00.000Z`),
          paidAt: new Date(`${row.bookingDate}T12:00:00.000Z`), paymentStatus: 'paid', ledgerEffect: 'cash',
          source: 'bank_csv', sourceKey: `bank_csv:${row.fingerprint}`, importFingerprint: row.fingerprint,
          netCents: amount, vatCents: 0, grossCents: amount, vatRate: 0, accountId: body.accountId,
        } },
        { upsert: true }
      )
      if (result.upsertedCount) imported += 1
      else skipped += 1
    }
    return NextResponse.json({ success: true, data: { imported, matched, skipped } })
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Import fehlgeschlagen.' }, { status: 400 })
  }
}
