"use client"
import { useState } from 'react'
import { FileUp, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { fetchWithIntent } from '@/lib/http/fetchWithIntent'
import type { FinanceAccountDto } from '@/types/finance'
import { formatDate, formatMoney } from '../financeUi'

interface PreviewRow { rowNumber:number; bookingDate:string; amountCents:number; reference:string; counterparty?:string; fingerprint:string; duplicate:boolean; suggestedMatch?:{id:string;title:string} }

export function FinanceBankImport({ accounts, onChanged }: { accounts: FinanceAccountDto[]; onChanged: () => void }) {
  const [open, setOpen] = useState(false)
  const [accountId, setAccountId] = useState(accounts.find(item => item.isDefault)?.id || '')
  const [csv, setCsv] = useState('')
  const [rows, setRows] = useState<PreviewRow[]>([])
  const [decisions, setDecisions] = useState<Record<string,'import'|'match'|'skip'>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const preview = async () => {
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/finanzen/bank-import/preview', { method:'POST', headers:{'Content-Type':'application/json'}, credentials:'include', body:JSON.stringify({csv,accountId}) })
      const result = await response.json(); if (!response.ok) throw new Error(result.error)
      setRows(result.data)
      setDecisions(Object.fromEntries((result.data as PreviewRow[]).map(row => [row.fingerprint, row.duplicate ? 'skip' : row.suggestedMatch ? 'match' : 'import'])))
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Vorschau fehlgeschlagen.') } finally { setBusy(false) }
  }
  const commit = async () => {
    setBusy(true); setError('')
    try {
      const payload = rows.map(row => ({ fingerprint:row.fingerprint, action:decisions[row.fingerprint] || 'skip', matchEntryId:decisions[row.fingerprint] === 'match' ? row.suggestedMatch?.id : undefined }))
      const response = await fetchWithIntent('/api/finanzen/bank-import/commit', { method:'POST', intent:'finance:bank-import', body:JSON.stringify({csv,accountId,decisions:payload}) })
      const result = await response.json(); if (!response.ok) throw new Error(result.error)
      setOpen(false); setRows([]); setCsv(''); onChanged()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Import fehlgeschlagen.') } finally { setBusy(false) }
  }
  return <><Button variant="outline" onClick={() => setOpen(true)}><FileUp className="mr-2 h-4 w-4"/>Bank-CSV</Button><Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto"><DialogHeader><DialogTitle>Bankumsätze importieren</DialogTitle><DialogDescription>CSV wird zunächst geprüft. Dubletten und passende vorhandene Buchungen werden vor der Übernahme angezeigt.</DialogDescription></DialogHeader><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-1.5"><Label>Konto</Label><Select value={accountId} onValueChange={setAccountId}><SelectTrigger><SelectValue placeholder="Konto wählen"/></SelectTrigger><SelectContent>{accounts.filter(item => item.isActive).map(item => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1.5"><Label>CSV-Datei</Label><Input type="file" accept=".csv,text/csv" onChange={async event => { const file=event.target.files?.[0]; if(file){setCsv(await file.text());setRows([])} }}/></div></div>{rows.length > 0 && <div className="rounded-lg border"><Table><TableHeader><TableRow><TableHead>Datum</TableHead><TableHead>Text</TableHead><TableHead className="text-right">Betrag</TableHead><TableHead>Erkennung</TableHead><TableHead>Aktion</TableHead></TableRow></TableHeader><TableBody>{rows.map(row => <TableRow key={row.fingerprint}><TableCell>{formatDate(row.bookingDate)}</TableCell><TableCell><p className="max-w-xs truncate font-medium">{row.counterparty || row.reference}</p><p className="max-w-xs truncate text-xs text-slate-500">{row.reference}</p></TableCell><TableCell className={`text-right font-medium ${row.amountCents>=0?'text-emerald-600':'text-rose-600'}`}>{formatMoney(row.amountCents)}</TableCell><TableCell className="text-xs">{row.duplicate ? 'Bereits importiert' : row.suggestedMatch ? `Treffer: ${row.suggestedMatch.title}` : 'Neue Bankbuchung'}</TableCell><TableCell><Select value={decisions[row.fingerprint]} onValueChange={value => setDecisions({...decisions,[row.fingerprint]:value as 'import'|'match'|'skip'})}><SelectTrigger className="w-36"><SelectValue/></SelectTrigger><SelectContent>{row.suggestedMatch && <SelectItem value="match">Abgleichen</SelectItem>}<SelectItem value="import">Neu importieren</SelectItem><SelectItem value="skip">Überspringen</SelectItem></SelectContent></Select></TableCell></TableRow>)}</TableBody></Table></div>}{error && <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">{error}</p>}<DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>{rows.length ? <Button onClick={commit} disabled={busy}>{busy&&<Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Auswahl übernehmen</Button> : <Button onClick={preview} disabled={busy||!csv||!accountId}>{busy&&<Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Vorschau prüfen</Button>}</DialogFooter></DialogContent></Dialog></>
}
