"use client"
import { useCallback, useEffect, useState } from 'react'
import { Landmark, Loader2, Plus, Tags, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { fetchWithIntent } from '@/lib/http/fetchWithIntent'
import type { FinanceOverviewDto } from '@/types/finance'
import { dateInput, formatDate, formatMoney } from '../financeUi'

interface RateRow { _id:string; employeeName?:string; validFrom:string; baseHourlyCents:number; travelHourlyCents:number; nightSurchargePercent:number; sundaySurchargePercent:number; holidaySurchargePercent:number }
interface EmployeeRow { _id:string; name:string; miNumber?:number }

export function FinanceMasterData({ data, onChanged }: { data: FinanceOverviewDto; onChanged: () => void }) {
  const [rates, setRates] = useState<RateRow[]>([])
  const [employees, setEmployees] = useState<EmployeeRow[]>([])
  const [accountOpen, setAccountOpen] = useState(false)
  const [rateOpen, setRateOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [account, setAccount] = useState({ name:'', type:'bank', iban:'', bankName:'', opening:'', balanceDate:dateInput(), isDefault:data.accounts.length === 0 })
  const [rate, setRate] = useState({ employeeId:'', validFrom:dateInput(), base:'', travel:'', night:'25', sunday:'50', holiday:'100' })
  const loadRates = useCallback(async () => {
    const response = await fetch('/api/finanzen/employee-rates', { credentials:'include' })
    if (!response.ok) return
    const result = await response.json(); setRates(result.data || []); setEmployees(result.employees || [])
  }, [])
  useEffect(() => { void loadRates() }, [loadRates])
  async function run(action: () => Promise<void>) { setBusy(true); setError(''); try { await action() } catch (cause) { setError(cause instanceof Error ? cause.message : 'Aktion fehlgeschlagen.') } finally { setBusy(false) } }
  const submitAccount = () => run(async () => {
    const response = await fetchWithIntent('/api/finanzen/accounts', { method:'POST', intent:'finance:account:create', body:JSON.stringify({
      name:account.name, type:account.type, iban:account.iban || undefined, bankName:account.bankName || undefined,
      openingBalanceCents:Math.round((Number(account.opening.replace(',','.')) || 0) * 100), balanceDate:account.balanceDate,
      isDefault:account.isDefault, isActive:true,
    }) })
    const result=await response.json(); if(!response.ok) throw new Error(result.error || 'Konto konnte nicht gespeichert werden.')
    setAccountOpen(false); onChanged()
  })
  const submitRate = () => run(async () => {
    const response = await fetchWithIntent('/api/finanzen/employee-rates', { method:'POST', intent:'finance:rate:create', body:JSON.stringify({
      employeeId:rate.employeeId, validFrom:rate.validFrom, baseHourlyCents:Math.round(Number(rate.base.replace(',','.')) * 100),
      travelHourlyCents:Math.round(Number(rate.travel.replace(',','.')) * 100), nightSurchargePercent:Number(rate.night),
      sundaySurchargePercent:Number(rate.sunday), holidaySurchargePercent:Number(rate.holiday),
    }) })
    const result=await response.json(); if(!response.ok) throw new Error(result.error || result.issues?.[0]?.message || 'Lohnsatz konnte nicht gespeichert werden.')
    setRateOpen(false); await loadRates(); onChanged()
  })

  return <div className="space-y-4">
    {error && <div className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">{error}</div>}
    <Card>
      <CardHeader className="flex-row items-start justify-between"><div><CardTitle className="flex items-center gap-2 text-base"><Landmark className="h-4 w-4 text-blue-600"/>Bank- und Kassenkonten</CardTitle><CardDescription>Kontostände verwenden ausschließlich bestätigte Cash-Buchungen</CardDescription></div><Button size="sm" onClick={() => setAccountOpen(true)}><Plus className="mr-2 h-4 w-4"/>Konto</Button></CardHeader>
      <CardContent><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{data.accounts.map(item => <div key={item.id} className="rounded-xl border p-4"><div className="flex items-start justify-between"><div><p className="font-medium">{item.name}</p><p className="text-xs text-slate-500">{item.bankName || (item.type === 'cash' ? 'Kasse' : 'Bankkonto')}</p></div>{item.isDefault && <Badge>Standard</Badge>}</div><p className="mt-5 text-2xl font-semibold tabular-nums">{formatMoney(item.currentBalanceCents)}</p><div className="mt-2 flex justify-between text-xs text-slate-500"><span>Eröffnung {formatDate(item.balanceDate)}</span><span>{item.iban || 'Keine IBAN'}</span></div></div>)}{!data.accounts.length && <Empty text="Noch kein Finanzkonto angelegt."/>}</div></CardContent>
    </Card>
    <Card>
      <CardHeader className="flex-row items-start justify-between"><div><CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4 text-blue-600"/>Stundenlohnhistorie</CardTitle><CardDescription>Vertrauliche Sätze ausschließlich für Super-Admins</CardDescription></div><Button size="sm" onClick={() => setRateOpen(true)}><Plus className="mr-2 h-4 w-4"/>Lohnsatz</Button></CardHeader>
      <CardContent><div className="rounded-lg border"><Table><TableHeader><TableRow><TableHead>Mitarbeiter</TableHead><TableHead>Gültig ab</TableHead><TableHead className="text-right">Grundlohn</TableHead><TableHead className="text-right">Fahrt</TableHead><TableHead className="text-right">Nacht</TableHead><TableHead className="text-right">Sonntag</TableHead><TableHead className="text-right">Feiertag</TableHead></TableRow></TableHeader><TableBody>{rates.length ? rates.map(item => <TableRow key={item._id}><TableCell className="font-medium">{item.employeeName || 'Unbekannt'}</TableCell><TableCell>{formatDate(item.validFrom)}</TableCell><TableCell className="text-right">{formatMoney(item.baseHourlyCents)} / h</TableCell><TableCell className="text-right">{formatMoney(item.travelHourlyCents)} / h</TableCell><TableCell className="text-right">{item.nightSurchargePercent} %</TableCell><TableCell className="text-right">{item.sundaySurchargePercent} %</TableCell><TableCell className="text-right">{item.holidaySurchargePercent} %</TableCell></TableRow>) : <TableRow><TableCell colSpan={7} className="h-28 text-center text-slate-500">Noch keine Lohnsätze. Arbeitszeiten werden als Datenlücke markiert.</TableCell></TableRow>}</TableBody></Table></div></CardContent>
    </Card>
    <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Tags className="h-4 w-4 text-blue-600"/>Finanzkategorien</CardTitle><CardDescription>Systemkategorien sichern automatische Projektkosten-Zuordnungen.</CardDescription></CardHeader><CardContent><div className="flex flex-wrap gap-2">{data.categories.map(item => <Badge key={item.id} variant="outline" className={!item.isActive ? 'opacity-50' : ''}><span className="mr-2 h-2 w-2 rounded-full" style={{backgroundColor:item.color}}/>{item.name}{item.isSystem ? ' · System' : ''}</Badge>)}</div></CardContent></Card>
    <Dialog open={accountOpen} onOpenChange={setAccountOpen}><DialogContent><DialogHeader><DialogTitle>Finanzkonto anlegen</DialogTitle><DialogDescription>Eröffnungssaldo und Saldenstichtag bilden die Kontobasis.</DialogDescription></DialogHeader><div className="grid gap-4 sm:grid-cols-2"><Field label="Name"><Input value={account.name} onChange={event=>setAccount({...account,name:event.target.value})}/></Field><Field label="Typ"><Select value={account.type} onValueChange={type=>setAccount({...account,type})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="bank">Bankkonto</SelectItem><SelectItem value="cash">Kasse</SelectItem></SelectContent></Select></Field><Field label="Bank"><Input value={account.bankName} onChange={event=>setAccount({...account,bankName:event.target.value})}/></Field><Field label="IBAN"><Input value={account.iban} onChange={event=>setAccount({...account,iban:event.target.value})}/></Field><Field label="Eröffnungssaldo (€)"><Input type="number" step="0.01" value={account.opening} onChange={event=>setAccount({...account,opening:event.target.value})}/></Field><Field label="Saldenstichtag"><Input type="date" value={account.balanceDate} onChange={event=>setAccount({...account,balanceDate:event.target.value})}/></Field><div className="flex items-center gap-3 sm:col-span-2"><Switch checked={account.isDefault} onCheckedChange={isDefault=>setAccount({...account,isDefault})}/><Label>Als Standardkonto verwenden</Label></div></div><DialogFooter><Button variant="outline" onClick={()=>setAccountOpen(false)}>Abbrechen</Button><Button onClick={submitAccount} disabled={busy || !account.name}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Speichern</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={rateOpen} onOpenChange={setRateOpen}><DialogContent><DialogHeader><DialogTitle>Lohnsatz hinzufügen</DialogTitle><DialogDescription>Historische Sätze bleiben unverändert erhalten.</DialogDescription></DialogHeader><div className="grid gap-4 sm:grid-cols-2"><Field label="Mitarbeiter"><Select value={rate.employeeId} onValueChange={employeeId=>setRate({...rate,employeeId})}><SelectTrigger><SelectValue placeholder="Mitarbeiter wählen"/></SelectTrigger><SelectContent>{employees.map(item=><SelectItem key={item._id} value={item._id}>{item.name}{item.miNumber ? ` · ${item.miNumber}` : ''}</SelectItem>)}</SelectContent></Select></Field><Field label="Gültig ab"><Input type="date" value={rate.validFrom} onChange={event=>setRate({...rate,validFrom:event.target.value})}/></Field><Field label="Grundlohn (€ / h)"><Input type="number" step="0.01" value={rate.base} onChange={event=>setRate({...rate,base:event.target.value})}/></Field><Field label="Fahrt (€ / h)"><Input type="number" step="0.01" value={rate.travel} onChange={event=>setRate({...rate,travel:event.target.value})}/></Field><Field label="Nacht (%)"><Input type="number" value={rate.night} onChange={event=>setRate({...rate,night:event.target.value})}/></Field><Field label="Sonntag (%)"><Input type="number" value={rate.sunday} onChange={event=>setRate({...rate,sunday:event.target.value})}/></Field><Field label="Feiertag (%)"><Input type="number" value={rate.holiday} onChange={event=>setRate({...rate,holiday:event.target.value})}/></Field></div><DialogFooter><Button variant="outline" onClick={()=>setRateOpen(false)}>Abbrechen</Button><Button onClick={submitRate} disabled={busy || !rate.employeeId || !rate.base}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Satz speichern</Button></DialogFooter></DialogContent></Dialog>
  </div>
}

function Empty({text}:{text:string}) { return <div className="rounded-xl border border-dashed p-8 text-center text-sm text-slate-500">{text}</div> }
function Field({label,children}:{label:string;children:React.ReactNode}) { return <div className="space-y-1.5"><Label>{label}</Label>{children}</div> }
