"use client"
import { useState } from 'react'
import { CalendarClock, Gauge, Loader2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { fetchWithIntent } from '@/lib/http/fetchWithIntent'
import type { FinanceOverviewDto } from '@/types/finance'
import { dateInput, formatDate, formatMoney } from '../financeUi'

export function FinancePlanning({ data, onChanged }: { data: FinanceOverviewDto; onChanged: () => void }) {
  const now = new Date()
  const [budgetOpen, setBudgetOpen] = useState(false)
  const [recurringOpen, setRecurringOpen] = useState(false)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [budget, setBudget] = useState({ name: '', limit: '', basis: 'performance', period: 'month', year: String(now.getFullYear()), month: String(now.getMonth() + 1), quarter: String(Math.ceil((now.getMonth() + 1) / 3)), categoryId: '', projectId: '', warningPercent: '80' })
  const [recurring, setRecurring] = useState({ name: '', title: '', amount: '', vatRate: '19', interval: 'monthly', nextDueDate: dateInput(), categoryId: '', projectId: '', direction: 'expense' })

  async function run(key: string, action: () => Promise<void>) {
    setBusy(key); setError('')
    try { await action() } catch (cause) { setError(cause instanceof Error ? cause.message : 'Aktion fehlgeschlagen.') } finally { setBusy('') }
  }
  const createBudget = () => run('budget', async () => {
    const response = await fetchWithIntent('/api/finanzen/budgets', { method: 'POST', intent: 'finance:budget:create', body: JSON.stringify({
      name: budget.name, limitCents: Math.round((Number(budget.limit.replace(',', '.')) || 0) * 100), basis: budget.basis,
      period: budget.period, year: Number(budget.year), month: budget.period === 'month' ? Number(budget.month) : undefined,
      quarter: budget.period === 'quarter' ? Number(budget.quarter) : undefined, categoryId: budget.categoryId || undefined,
      projectId: budget.projectId || undefined, warningPercent: Number(budget.warningPercent), isActive: true,
    }) })
    const result = await response.json(); if (!response.ok) throw new Error(result.issues?.[0]?.message || result.error)
    setBudgetOpen(false); onChanged()
  })
  const createRecurring = () => run('recurring', async () => {
    const netCents = Math.round((Number(recurring.amount.replace(',', '.')) || 0) * 100)
    const vatRate = Number(recurring.vatRate); const vatCents = Math.round(netCents * vatRate / 100)
    const response = await fetchWithIntent('/api/finanzen/recurring', { method: 'POST', intent: 'finance:recurring:create', body: JSON.stringify({
      name: recurring.name, interval: recurring.interval, nextDueDate: recurring.nextDueDate, isActive: true,
      entryTemplate: { direction: recurring.direction, title: recurring.title, recognitionDate: recurring.nextDueDate, paymentStatus: 'open', ledgerEffect: 'performance', netCents, vatCents, grossCents: netCents + vatCents, vatRate, categoryId: recurring.categoryId || undefined, projectId: recurring.projectId || undefined, source: 'manual' },
    }) })
    const result = await response.json(); if (!response.ok) throw new Error(result.issues?.[0]?.message || result.error)
    setRecurringOpen(false); onChanged()
  })
  const periodKey = (date: string, interval: string) => {
    const value = new Date(date); const year = value.getUTCFullYear(); const month = value.getUTCMonth() + 1
    return interval === 'yearly' ? `${year}` : interval === 'quarterly' ? `${year}-Q${Math.ceil(month / 3)}` : `${year}-${String(month).padStart(2, '0')}`
  }
  const book = (id: string, expectedPeriod: string) => run(`book:${id}`, async () => {
    const response = await fetchWithIntent(`/api/finanzen/recurring/${id}/book`, { method: 'POST', intent: 'finance:recurring:book', body: JSON.stringify({ periodKey: expectedPeriod }) })
    const result = await response.json(); if (!response.ok) throw new Error(result.error)
    onChanged()
  })

  return <div className="grid gap-4 xl:grid-cols-2">
    {error && <div className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950/30 dark:text-rose-300 xl:col-span-2">{error}</div>}
    <Card>
      <CardHeader className="flex-row items-start justify-between"><div><CardTitle className="flex items-center gap-2 text-base"><Gauge className="h-4 w-4 text-blue-600"/>Limits und Budgets</CardTitle><CardDescription>Ergebnisbasis umfasst Personal und Subunternehmen</CardDescription></div><Button size="sm" onClick={() => setBudgetOpen(true)}><Plus className="mr-2 h-4 w-4"/>Limit</Button></CardHeader>
      <CardContent className="space-y-3">{data.budgets.length ? data.budgets.map(item => <div key={item.id} className="rounded-lg border p-3"><div className="flex items-start justify-between gap-3"><div><p className="font-medium">{item.name}</p><p className="text-xs text-slate-500">{item.basis === 'performance' ? 'Ergebnisbasis' : 'Cashbasis'} · {item.categoryName || 'Alle Kategorien'}{item.projectName ? ` · ${item.projectName}` : ''}</p></div><span className={`text-sm font-semibold ${item.utilizationPercent >= 100 ? 'text-rose-600' : item.utilizationPercent >= item.warningPercent ? 'text-amber-600' : ''}`}>{item.utilizationPercent.toLocaleString('de-DE')} %</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className={`h-full rounded-full ${item.utilizationPercent >= 100 ? 'bg-rose-500' : item.utilizationPercent >= item.warningPercent ? 'bg-amber-500' : 'bg-blue-600'}`} style={{ width: `${Math.min(100, item.utilizationPercent)}%` }}/></div><div className="mt-2 flex justify-between text-xs text-slate-500"><span>{formatMoney(item.spentCents)} verbraucht</span><span>{formatMoney(item.limitCents)} Limit</span></div></div>) : <Empty text="Noch keine Limits definiert."/>}</CardContent>
    </Card>
    <Card>
      <CardHeader className="flex-row items-start justify-between"><div><CardTitle className="flex items-center gap-2 text-base"><CalendarClock className="h-4 w-4 text-blue-600"/>Wiederkehrende Buchungen</CardTitle><CardDescription>Buchung nur nach ausdrücklicher Bestätigung</CardDescription></div><Button size="sm" onClick={() => setRecurringOpen(true)}><Plus className="mr-2 h-4 w-4"/>Regel</Button></CardHeader>
      <CardContent className="space-y-3">{data.recurringRules.length ? data.recurringRules.map(rule => <div key={rule.id} className="flex items-center justify-between gap-4 rounded-lg border p-3"><div className="min-w-0"><p className="truncate font-medium">{rule.name}</p><p className="text-xs text-slate-500">Fällig {formatDate(rule.nextDueDate)} · {formatMoney(rule.entryTemplate.grossCents)}</p></div><Button variant="outline" size="sm" disabled={!rule.isActive || busy === `book:${rule.id}`} onClick={() => book(rule.id, periodKey(rule.nextDueDate, rule.interval))}>{busy === `book:${rule.id}` && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Periode buchen</Button></div>) : <Empty text="Noch keine wiederkehrenden Regeln."/>}</CardContent>
    </Card>
    <Dialog open={budgetOpen} onOpenChange={setBudgetOpen}><DialogContent><DialogHeader><DialogTitle>Budgetlimit definieren</DialogTitle><DialogDescription>Optional auf Kategorie und Projekt einschränken.</DialogDescription></DialogHeader><div className="grid gap-4 sm:grid-cols-2"><InputField label="Name" value={budget.name} onChange={name => setBudget({...budget,name})}/><InputField label="Limit (€)" type="number" value={budget.limit} onChange={limit => setBudget({...budget,limit})}/><SelectField label="Basis" value={budget.basis} onChange={basis => setBudget({...budget,basis})} options={[["performance","Ergebnis"],["cash","Cashflow"]]}/><SelectField label="Periode" value={budget.period} onChange={period => setBudget({...budget,period})} options={[["month","Monat"],["quarter","Quartal"],["year","Jahr"]]}/><InputField label="Jahr" type="number" value={budget.year} onChange={year => setBudget({...budget,year})}/>{budget.period === 'month' && <InputField label="Monat" type="number" value={budget.month} onChange={month => setBudget({...budget,month})}/>} {budget.period === 'quarter' && <InputField label="Quartal" type="number" value={budget.quarter} onChange={quarter => setBudget({...budget,quarter})}/>}<SelectEntity label="Kategorie" value={budget.categoryId} onChange={categoryId => setBudget({...budget,categoryId})} values={data.categories.map(item => [item.id,item.name])}/><SelectEntity label="Projekt" value={budget.projectId} onChange={projectId => setBudget({...budget,projectId})} values={data.projects.map(item => [item.projectId,item.projectName])}/></div><DialogFooter><Button variant="outline" onClick={() => setBudgetOpen(false)}>Abbrechen</Button><Button onClick={createBudget} disabled={busy === 'budget' || !budget.name || !budget.limit}>{busy === 'budget' && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Speichern</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={recurringOpen} onOpenChange={setRecurringOpen}><DialogContent><DialogHeader><DialogTitle>Wiederkehrende Buchung</DialogTitle><DialogDescription>Zum Beispiel für Miete oder Versicherung.</DialogDescription></DialogHeader><div className="grid gap-4 sm:grid-cols-2"><InputField label="Regelname" value={recurring.name} onChange={name => setRecurring({...recurring,name})}/><InputField label="Buchungstitel" value={recurring.title} onChange={title => setRecurring({...recurring,title})}/><InputField label="Netto (€)" type="number" value={recurring.amount} onChange={amount => setRecurring({...recurring,amount})}/><SelectField label="USt." value={recurring.vatRate} onChange={vatRate => setRecurring({...recurring,vatRate})} options={[["0","0 %"],["7","7 %"],["19","19 %"]]}/><SelectField label="Intervall" value={recurring.interval} onChange={interval => setRecurring({...recurring,interval})} options={[["monthly","Monatlich"],["quarterly","Quartalsweise"],["yearly","Jährlich"]]}/><InputField label="Nächste Fälligkeit" type="date" value={recurring.nextDueDate} onChange={nextDueDate => setRecurring({...recurring,nextDueDate})}/><SelectEntity label="Kategorie" value={recurring.categoryId} onChange={categoryId => setRecurring({...recurring,categoryId})} values={data.categories.filter(item => item.direction !== 'income').map(item => [item.id,item.name])}/><SelectEntity label="Projekt" value={recurring.projectId} onChange={projectId => setRecurring({...recurring,projectId})} values={data.projects.map(item => [item.projectId,item.projectName])}/></div><DialogFooter><Button variant="outline" onClick={() => setRecurringOpen(false)}>Abbrechen</Button><Button onClick={createRecurring} disabled={busy === 'recurring' || !recurring.name || !recurring.title || !recurring.amount}>{busy === 'recurring' && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Regel speichern</Button></DialogFooter></DialogContent></Dialog>
  </div>
}

function Empty({ text }: { text: string }) { return <div className="rounded-lg border border-dashed p-8 text-center text-sm text-slate-500">{text}</div> }
function InputField({ label, value, onChange, type = 'text' }: { label:string; value:string; onChange:(value:string)=>void; type?:string }) { return <div className="space-y-1.5"><Label>{label}</Label><Input type={type} value={value} onChange={event => onChange(event.target.value)}/></div> }
function SelectField({ label, value, onChange, options }: { label:string; value:string; onChange:(value:string)=>void; options:string[][] }) { return <div className="space-y-1.5"><Label>{label}</Label><Select value={value} onValueChange={onChange}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{options.map(([key,text]) => <SelectItem key={key} value={key}>{text}</SelectItem>)}</SelectContent></Select></div> }
function SelectEntity({ label, value, onChange, values }: { label:string; value:string; onChange:(value:string)=>void; values:string[][] }) { return <div className="space-y-1.5"><Label>{label}</Label><Select value={value || 'none'} onValueChange={next => onChange(next === 'none' ? '' : next)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="none">Alle / ohne Zuordnung</SelectItem>{values.map(([key,text]) => <SelectItem key={key} value={key}>{text}</SelectItem>)}</SelectContent></Select></div> }
