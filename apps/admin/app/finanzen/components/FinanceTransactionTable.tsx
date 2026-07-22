"use client"
import { useMemo, useState } from 'react'
import { Download, FileText, Search, Trash2 } from 'lucide-react'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { FinanceEntryDto } from '@/types/finance'
import { downloadBlob, formatDate, formatMoney, sourceLabels } from '../financeUi'

export function FinanceTransactionTable({ entries, onDelete }: { entries: FinanceEntryDto[]; onDelete?: (entry: FinanceEntryDto) => void }) {
  const [basis, setBasis] = useState<'performance' | 'cash'>('performance')
  const [query, setQuery] = useState('')
  const [source, setSource] = useState('all')
  const filtered = useMemo(() => entries.filter(entry => {
    const affects = basis === 'performance'
      ? entry.ledgerEffect === 'performance' || entry.ledgerEffect === 'both'
      : (entry.ledgerEffect === 'cash' || entry.ledgerEffect === 'both') && entry.paymentStatus === 'paid'
    const haystack = `${entry.title} ${entry.description || ''} ${entry.projectName || ''} ${entry.reference || ''} ${entry.invoiceNumber || ''}`.toLocaleLowerCase('de')
    return affects && (source === 'all' || entry.source === source) && haystack.includes(query.trim().toLocaleLowerCase('de'))
  }), [basis, entries, query, source])

  const exportCsv = () => {
    const rows = [['Datum','Art','Titel','Projekt','Kategorie','Quelle','Netto','USt','Brutto','Status'], ...filtered.map(entry => [
      formatDate(entry.recognitionDate), entry.direction === 'income' ? 'Einnahme' : 'Ausgabe', entry.title, entry.projectName || '', entry.categoryName || '', sourceLabels[entry.source],
      (entry.netCents / 100).toFixed(2), (entry.vatCents / 100).toFixed(2), (entry.grossCents / 100).toFixed(2), entry.paymentStatus,
    ])]
    const csv = rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(';')).join('\n')
    downloadBlob(`\uFEFF${csv}`, `gleistrix-finanzen-${new Date().toISOString().slice(0,10)}.csv`, 'text/csv;charset=utf-8')
  }

  const exportPdf = () => {
    const document = new jsPDF({ orientation: 'landscape' })
    document.setFontSize(16)
    document.text(`Gleistrix Finanzen · ${basis === 'cash' ? 'Cashflow' : 'Ergebnis'}`, 14, 16)
    autoTable(document, {
      startY: 22,
      head: [['Datum','Art','Titel','Projekt','Quelle','Netto','Brutto']],
      body: filtered.map(entry => [formatDate(entry.recognitionDate), entry.direction === 'income' ? 'Einnahme' : 'Ausgabe', entry.title, entry.projectName || '—', sourceLabels[entry.source], formatMoney(entry.netCents), formatMoney(entry.grossCents)]),
      styles: { fontSize: 8 }, headStyles: { fillColor: [37, 99, 235] },
    })
    document.save(`gleistrix-finanzen-${new Date().toISOString().slice(0,10)}.pdf`)
  }

  return (
    <Card>
      <CardHeader className="gap-4 pb-3 lg:flex-row lg:items-center lg:justify-between">
        <div><CardTitle className="text-base">Transaktionsübersicht</CardTitle><CardDescription>{filtered.length} Buchungen in der aktuellen Sicht</CardDescription></div>
        <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={exportCsv}><Download className="mr-2 h-4 w-4"/>CSV</Button><Button variant="outline" size="sm" onClick={exportPdf}><FileText className="mr-2 h-4 w-4"/>PDF</Button></div>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <Tabs value={basis} onValueChange={value => setBasis(value as 'performance' | 'cash')}><TabsList><TabsTrigger value="performance">Ergebnis</TabsTrigger><TabsTrigger value="cash">Cashflow</TabsTrigger></TabsList></Tabs>
          <div className="flex flex-1 flex-col gap-2 sm:flex-row lg:max-w-2xl">
            <div className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400"/><Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buchungen durchsuchen…" className="pl-9"/></div>
            <Select value={source} onValueChange={setSource}><SelectTrigger className="sm:w-48"><SelectValue placeholder="Quelle"/></SelectTrigger><SelectContent><SelectItem value="all">Alle Quellen</SelectItem>{Object.entries(sourceLabels).map(([value,label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>
          </div>
        </div>
        <div className="rounded-lg border">
          <Table>
            <TableHeader><TableRow><TableHead>Datum</TableHead><TableHead>Buchung</TableHead><TableHead>Projekt / Kategorie</TableHead><TableHead>Quelle</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Netto</TableHead><TableHead className="text-right">Brutto</TableHead><TableHead className="w-10"/></TableRow></TableHeader>
            <TableBody>
              {filtered.length ? filtered.map(entry => <TableRow key={entry.id}>
                <TableCell className="whitespace-nowrap text-slate-500">{formatDate(entry.recognitionDate)}</TableCell>
                <TableCell><div className="max-w-xs"><div className="flex items-center gap-2"><span className={`h-2 w-2 shrink-0 rounded-full ${entry.direction === 'income' ? 'bg-emerald-500' : 'bg-rose-500'}`}/><span className="truncate font-medium">{entry.title}</span></div>{entry.description && <p className="mt-1 truncate text-xs text-slate-500">{entry.description}</p>}</div></TableCell>
                <TableCell><p className="max-w-48 truncate text-sm">{entry.projectName || 'Unternehmen'}</p><p className="text-xs text-slate-500">{entry.categoryName || 'Ohne Kategorie'}</p></TableCell>
                <TableCell><Badge variant="outline" className="whitespace-nowrap">{sourceLabels[entry.source]}{entry.estimated ? ' · geschätzt' : ''}</Badge></TableCell>
                <TableCell><Badge variant={entry.paymentStatus === 'paid' ? 'default' : 'secondary'}>{entry.paymentStatus === 'paid' ? 'Bezahlt' : entry.paymentStatus === 'open' ? 'Offen' : entry.paymentStatus === 'not_applicable' ? 'Kalkulatorisch' : 'Storniert'}</Badge></TableCell>
                <TableCell className={`text-right font-medium tabular-nums ${entry.direction === 'income' ? 'text-emerald-600' : ''}`}>{entry.direction === 'expense' ? '−' : '+'}{formatMoney(entry.netCents)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatMoney(entry.grossCents)}</TableCell>
                <TableCell>{!entry.readOnly && onDelete && <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600" onClick={() => onDelete(entry)} aria-label="Buchung löschen"><Trash2 className="h-4 w-4"/></Button>}</TableCell>
              </TableRow>) : <TableRow><TableCell colSpan={8} className="h-32 text-center text-slate-500">Keine Buchungen für Filter und Zeitraum.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
