"use client"
import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { fetchWithIntent } from '@/lib/http/fetchWithIntent'
import type { FinanceOverviewDto } from '@/types/finance'
import { dateInput, formatMoney } from '../financeUi'

interface ResourceOption { id: string; label: string }
interface Draft {
  direction?: 'income' | 'expense'; title?: string; description?: string; recognitionDate?: string; dueDate?: string;
  paymentStatus?: 'open' | 'paid'; netCents?: number; grossCents?: number; vatRate?: number; categoryHint?: string;
  reference?: string; invoiceNumber?: string; source?: 'ai_receipt'
}

export function FinanceEntryDialog({ open, onOpenChange, overview, resources, initialDraft, onSaved }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  overview: FinanceOverviewDto
  resources: { vehicles: ResourceOption[]; materials: ResourceOption[] }
  initialDraft?: Draft | null
  onSaved: () => void
}) {
  const empty = useMemo(() => ({
    direction: 'expense' as 'income' | 'expense', title: '', description: '', amountMode: 'net' as 'net' | 'gross', amount: '', vatRate: '19',
    recognitionDate: dateInput(), dueDate: '', paymentStatus: 'open' as 'open' | 'paid', paidAt: dateInput(),
    ledgerEffect: 'both' as 'performance' | 'cash' | 'both', accountId: '', projectId: '', categoryId: '', vehicleId: '', materialId: '',
    reference: '', invoiceNumber: '',
  }), [])
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!open) return
    if (!initialDraft) { setForm(empty); setError(''); return }
    setForm({
      ...empty,
      direction: initialDraft.direction || 'expense', title: initialDraft.title || '', description: initialDraft.description || '',
      amountMode: initialDraft.netCents === undefined ? 'gross' : 'net', amount: String((initialDraft.netCents ?? initialDraft.grossCents ?? 0) / 100),
      vatRate: String(initialDraft.vatRate ?? 19), recognitionDate: dateInput(initialDraft.recognitionDate), dueDate: initialDraft.dueDate ? dateInput(initialDraft.dueDate) : '',
      paymentStatus: initialDraft.paymentStatus || 'open', ledgerEffect: initialDraft.paymentStatus === 'paid' ? 'both' : 'performance',
      reference: initialDraft.reference || '', invoiceNumber: initialDraft.invoiceNumber || '',
      categoryId: overview.categories.find(category => category.name.toLocaleLowerCase('de').includes((initialDraft.categoryHint || '').toLocaleLowerCase('de')))?.id || '',
    })
    setError('')
  }, [empty, initialDraft, open, overview.categories])

  const cents = Math.max(0, Math.round((Number(String(form.amount).replace(',', '.')) || 0) * 100))
  const rate = Math.max(0, Number(form.vatRate) || 0)
  const amounts = form.amountMode === 'net'
    ? { netCents: cents, vatCents: Math.round(cents * rate / 100), grossCents: cents + Math.round(cents * rate / 100) }
    : { grossCents: cents, netCents: rate ? Math.round(cents / (1 + rate / 100)) : cents, vatCents: cents - (rate ? Math.round(cents / (1 + rate / 100)) : cents) }
  const set = (key: keyof typeof form, value: string) => setForm(current => ({ ...current, [key]: value }))

  const submit = async () => {
    setSaving(true); setError('')
    try {
      const response = await fetchWithIntent('/api/finanzen/entries', {
        method: 'POST', intent: 'finance:entry:create',
        body: JSON.stringify({
          ...form, ...amounts, vatRate: rate, source: initialDraft?.source || 'manual',
          dueDate: form.dueDate || undefined, paidAt: form.paymentStatus === 'paid' ? form.paidAt : undefined,
          accountId: form.accountId || undefined, projectId: form.projectId || undefined, categoryId: form.categoryId || undefined,
          vehicleId: form.vehicleId || undefined, materialId: form.materialId || undefined,
          reference: form.reference || undefined, invoiceNumber: form.invoiceNumber || undefined,
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.issues?.[0]?.message || result.error || 'Buchung konnte nicht gespeichert werden.')
      onOpenChange(false); onSaved()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Buchung konnte nicht gespeichert werden.') }
    finally { setSaving(false) }
  }

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto"><DialogHeader><DialogTitle>{initialDraft ? 'KI-Entwurf prüfen' : 'Buchung erfassen'}</DialogTitle><DialogDescription>{initialDraft ? 'Die KI-Werte sind ein unverbindlicher Entwurf. Bitte vor dem Speichern vollständig prüfen.' : 'Einnahme, Ausgabe oder offene Rechnung mit Ergebnis- und Cashflow-Wirkung erfassen.'}</DialogDescription></DialogHeader>
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Art"><Select value={form.direction} onValueChange={value => set('direction', value)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="income">Einnahme</SelectItem><SelectItem value="expense">Ausgabe</SelectItem></SelectContent></Select></Field>
      <Field label="Titel"><Input value={form.title} onChange={event => set('title', event.target.value)} placeholder="z. B. Fahrzeugbetankung"/></Field>
      <Field label="Beschreibung" wide><Textarea value={form.description} onChange={event => set('description', event.target.value)} rows={2}/></Field>
      <Field label="Betragsbasis"><Select value={form.amountMode} onValueChange={value => set('amountMode', value)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="net">Netto eingeben</SelectItem><SelectItem value="gross">Brutto eingeben</SelectItem></SelectContent></Select></Field>
      <Field label={form.amountMode === 'net' ? 'Nettobetrag (€)' : 'Bruttobetrag (€)'}><Input type="number" step="0.01" min="0" value={form.amount} onChange={event => set('amount', event.target.value)}/></Field>
      <Field label="Umsatzsteuer"><Select value={form.vatRate} onValueChange={value => set('vatRate', value)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{['0','7','19'].map(value => <SelectItem key={value} value={value}>{value} %</SelectItem>)}</SelectContent></Select></Field>
      <div className="rounded-lg border bg-slate-50 p-3 text-sm dark:bg-slate-900 sm:self-end"><div className="flex justify-between"><span>Netto</span><span>{formatMoney(amounts.netCents)}</span></div><div className="flex justify-between text-slate-500"><span>USt.</span><span>{formatMoney(amounts.vatCents)}</span></div><div className="mt-1 flex justify-between border-t pt-1 font-semibold"><span>Brutto</span><span>{formatMoney(amounts.grossCents)}</span></div></div>
      <Field label="Leistungsdatum"><Input type="date" value={form.recognitionDate} onChange={event => set('recognitionDate', event.target.value)}/></Field>
      <Field label="Fällig am"><Input type="date" value={form.dueDate} onChange={event => set('dueDate', event.target.value)}/></Field>
      <Field label="Zahlungsstatus"><Select value={form.paymentStatus} onValueChange={value => set('paymentStatus', value)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="open">Offen</SelectItem><SelectItem value="paid">Bezahlt</SelectItem></SelectContent></Select></Field>
      {form.paymentStatus === 'paid' && <Field label="Bezahlt am"><Input type="date" value={form.paidAt} onChange={event => set('paidAt', event.target.value)}/></Field>}
      <Field label="Wirkung"><Select value={form.ledgerEffect} onValueChange={value => set('ledgerEffect', value)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="performance">Nur Ergebnis</SelectItem><SelectItem value="cash">Nur Cashflow</SelectItem><SelectItem value="both">Ergebnis & Cashflow</SelectItem></SelectContent></Select></Field>
      <Field label="Konto"><Select value={form.accountId || 'none'} onValueChange={value => set('accountId', value === 'none' ? '' : value)}><SelectTrigger><SelectValue placeholder="Kein Konto"/></SelectTrigger><SelectContent><SelectItem value="none">Kein Konto</SelectItem>{overview.accounts.filter(account => account.isActive).map(account => <SelectItem key={account.id} value={account.id}>{account.name}</SelectItem>)}</SelectContent></Select></Field>
      <Field label="Kategorie"><Select value={form.categoryId || 'none'} onValueChange={value => set('categoryId', value === 'none' ? '' : value)}><SelectTrigger><SelectValue placeholder="Ohne Kategorie"/></SelectTrigger><SelectContent><SelectItem value="none">Ohne Kategorie</SelectItem>{overview.categories.filter(category => category.isActive && (category.direction === 'both' || category.direction === form.direction)).map(category => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}</SelectContent></Select></Field>
      <Field label="Projekt"><Select value={form.projectId || 'none'} onValueChange={value => set('projectId', value === 'none' ? '' : value)}><SelectTrigger><SelectValue placeholder="Unternehmensweit"/></SelectTrigger><SelectContent><SelectItem value="none">Unternehmensweit</SelectItem>{overview.projects.map(project => <SelectItem key={project.projectId} value={project.projectId}>{project.projectName}</SelectItem>)}</SelectContent></Select></Field>
      <Field label="Fahrzeug (optional)"><Select value={form.vehicleId || 'none'} onValueChange={value => set('vehicleId', value === 'none' ? '' : value)}><SelectTrigger><SelectValue placeholder="Kein Fahrzeug"/></SelectTrigger><SelectContent><SelectItem value="none">Kein Fahrzeug</SelectItem>{resources.vehicles.map(item => <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>)}</SelectContent></Select></Field>
      <Field label="Material (optional)"><Select value={form.materialId || 'none'} onValueChange={value => set('materialId', value === 'none' ? '' : value)}><SelectTrigger><SelectValue placeholder="Kein Material"/></SelectTrigger><SelectContent><SelectItem value="none">Kein Material</SelectItem>{resources.materials.map(item => <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>)}</SelectContent></Select></Field>
      <Field label="Rechnungsnummer"><Input value={form.invoiceNumber} onChange={event => set('invoiceNumber', event.target.value)}/></Field>
      <Field label="Referenz / Verwendungszweck"><Input value={form.reference} onChange={event => set('reference', event.target.value)}/></Field>
    </div>
    {error && <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">{error}</p>}
    <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button><Button onClick={submit} disabled={saving || !form.title || amounts.grossCents <= 0}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Buchung speichern</Button></DialogFooter>
  </DialogContent></Dialog>
}

function Field({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) { return <div className={`space-y-1.5 ${wide ? 'sm:col-span-2' : ''}`}><Label>{label}</Label>{children}</div> }
