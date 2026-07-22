"use client"
import { useCallback, useEffect, useState } from 'react'
import { Coins, Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { fetchWithIntent } from '@/lib/http/fetchWithIntent'
import { MITARBEITER_FUNKTION_OPTIONS } from '@/types/constants'

interface FunctionRate {
  _id: string
  funktion?: string
  validFrom: string
  baseHourlyCents: number
  travelHourlyCents: number
  nightSurchargePercent: number
  sundaySurchargePercent: number
  holidaySurchargePercent: number
}

const formatMoney = (cents: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format((cents || 0) / 100)
const formatDate = (value?: string) => value ? new Intl.DateTimeFormat('de-DE').format(new Date(value)) : '—'
const todayInput = () => new Date().toISOString().slice(0, 10)
const centsToInput = (cents: number) => (cents / 100).toFixed(2).replace('.', ',')
const toCents = (value: string) => Math.round((Number(String(value).replace(',', '.')) || 0) * 100)

interface RateForm { funktion: string; validFrom: string; base: string; travel: string; night: string; sunday: string; holiday: string }
const emptyForm: RateForm = { funktion: '', validFrom: todayInput(), base: '', travel: '', night: '25', sunday: '50', holiday: '100' }

export default function EmployeeFunctionRates({ employeeId, employeeName }: { employeeId: string; employeeName: string }) {
  const [rates, setRates] = useState<FunctionRate[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<RateForm>(emptyForm)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/finanzen/employee-rates?employeeId=${employeeId}`, { credentials: 'include' })
      if (!response.ok) return
      const result = await response.json()
      setRates(result.data || [])
    } finally {
      setLoading(false)
    }
  }, [employeeId])
  useEffect(() => { void load() }, [load])

  const openCreate = () => { setEditingId(null); setForm({ ...emptyForm, validFrom: todayInput() }); setError(''); setOpen(true) }
  const openEdit = (rate: FunctionRate) => {
    setEditingId(rate._id)
    setForm({
      funktion: rate.funktion || '', validFrom: rate.validFrom.slice(0, 10),
      base: centsToInput(rate.baseHourlyCents), travel: centsToInput(rate.travelHourlyCents),
      night: String(rate.nightSurchargePercent), sunday: String(rate.sundaySurchargePercent), holiday: String(rate.holidaySurchargePercent),
    })
    setError('')
    setOpen(true)
  }

  const submit = async () => {
    setBusy(true); setError('')
    try {
      const payload = {
        employeeId, funktion: form.funktion, validFrom: form.validFrom,
        baseHourlyCents: toCents(form.base), travelHourlyCents: toCents(form.travel),
        nightSurchargePercent: Number(form.night) || 0, sundaySurchargePercent: Number(form.sunday) || 0, holidaySurchargePercent: Number(form.holiday) || 0,
      }
      const response = editingId
        ? await fetchWithIntent(`/api/finanzen/employee-rates/${editingId}`, { method: 'PUT', intent: 'finance:rate:update', body: JSON.stringify(payload) })
        : await fetchWithIntent('/api/finanzen/employee-rates', { method: 'POST', intent: 'finance:rate:create', body: JSON.stringify(payload) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || result.issues?.[0]?.message || 'Lohnsatz konnte nicht gespeichert werden.')
      setOpen(false); await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Aktion fehlgeschlagen.')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (rate: FunctionRate) => {
    if (!window.confirm(`Lohnsatz für ${rate.funktion || 'Funktion'} (ab ${formatDate(rate.validFrom)}) wirklich löschen?`)) return
    setError('')
    try {
      const response = await fetchWithIntent(`/api/finanzen/employee-rates/${rate._id}`, { method: 'DELETE', intent: 'finance:rate:delete' })
      if (!response.ok) { const result = await response.json().catch(() => ({})); throw new Error(result.error || 'Löschen fehlgeschlagen.') }
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Löschen fehlgeschlagen.')
    }
  }

  return <Card>
    <CardHeader className="flex-row items-start justify-between">
      <div>
        <CardTitle className="flex items-center gap-2 text-base"><Coins className="h-4 w-4 text-blue-600" />Löhne je Funktion</CardTitle>
        <CardDescription>Stundenlohn je Funktion für {employeeName}. Grundlage der Personalkosten in der Finanzübersicht.</CardDescription>
      </div>
      <Button size="sm" onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Satz</Button>
    </CardHeader>
    <CardContent>
      {error && <div className="mb-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">{error}</div>}
      <div className="rounded-lg border">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Funktion</TableHead><TableHead>Gültig ab</TableHead>
            <TableHead className="text-right">Grundlohn</TableHead><TableHead className="text-right">Fahrt</TableHead>
            <TableHead className="text-right">Nacht</TableHead><TableHead className="text-right">Sonntag</TableHead><TableHead className="text-right">Feiertag</TableHead>
            <TableHead className="text-right">Aktionen</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {loading
              ? <TableRow><TableCell colSpan={8} className="h-24 text-center text-slate-500"><Loader2 className="mx-auto h-4 w-4 animate-spin" /></TableCell></TableRow>
              : rates.length
                ? rates.map(rate => <TableRow key={rate._id}>
                    <TableCell><Badge variant="outline">{rate.funktion || '—'}</Badge></TableCell>
                    <TableCell>{formatDate(rate.validFrom)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(rate.baseHourlyCents)} / h</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(rate.travelHourlyCents)} / h</TableCell>
                    <TableCell className="text-right tabular-nums">{rate.nightSurchargePercent} %</TableCell>
                    <TableCell className="text-right tabular-nums">{rate.sundaySurchargePercent} %</TableCell>
                    <TableCell className="text-right tabular-nums">{rate.holidaySurchargePercent} %</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(rate)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-rose-600" onClick={() => void remove(rate)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>)
                : <TableRow><TableCell colSpan={8} className="h-24 text-center text-slate-500">Noch keine Lohnsätze. Ohne Satz je Funktion erscheinen die Arbeitszeiten als Datenlücke in den Finanzen.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    </CardContent>

    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editingId ? 'Lohnsatz bearbeiten' : 'Lohnsatz hinzufügen'}</DialogTitle>
          <DialogDescription>Der Satz gilt ab dem gewählten Datum. Ältere Sätze bleiben für vergangene Einsätze erhalten.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Funktion">
            <Select value={form.funktion} onValueChange={funktion => setForm({ ...form, funktion })}>
              <SelectTrigger><SelectValue placeholder="Funktion wählen" /></SelectTrigger>
              <SelectContent>{MITARBEITER_FUNKTION_OPTIONS.map(item => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Gültig ab"><Input type="date" value={form.validFrom} onChange={event => setForm({ ...form, validFrom: event.target.value })} /></Field>
          <Field label="Grundlohn (€ / h)"><Input type="number" step="0.01" value={form.base} onChange={event => setForm({ ...form, base: event.target.value })} /></Field>
          <Field label="Fahrt (€ / h)"><Input type="number" step="0.01" value={form.travel} onChange={event => setForm({ ...form, travel: event.target.value })} /></Field>
          <Field label="Nacht (%)"><Input type="number" value={form.night} onChange={event => setForm({ ...form, night: event.target.value })} /></Field>
          <Field label="Sonntag (%)"><Input type="number" value={form.sunday} onChange={event => setForm({ ...form, sunday: event.target.value })} /></Field>
          <Field label="Feiertag (%)"><Input type="number" value={form.holiday} onChange={event => setForm({ ...form, holiday: event.target.value })} /></Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
          <Button onClick={() => void submit()} disabled={busy || !form.funktion || !form.base}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Speichern</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </Card>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>
}
