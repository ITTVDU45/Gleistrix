"use client"
import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Plus, RefreshCw, ShieldCheck } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { fetchWithIntent } from '@/lib/http/fetchWithIntent'
import type { FinanceEntryDto, FinanceOverviewDto } from '@/types/finance'
import { dateInput } from './financeUi'
import { FinanceAiPanel } from './components/FinanceAiPanel'
import { FinanceBankImport } from './components/FinanceBankImport'
import { FinanceCharts } from './components/FinanceCharts'
import { FinanceEntryDialog } from './components/FinanceEntryDialog'
import { FinanceKpiGrid } from './components/FinanceKpiGrid'
import { FinanceMasterData } from './components/FinanceMasterData'
import { FinancePlanning } from './components/FinancePlanning'
import { FinanceProjectTable } from './components/FinanceProjectTable'
import { FinanceTransactionTable } from './components/FinanceTransactionTable'

const initialPeriod = () => { const now=new Date(); return {from:dateInput(new Date(now.getFullYear(),now.getMonth(),1)),to:dateInput(new Date(now.getFullYear(),now.getMonth()+1,0))} }

export default function FinancePageClient() {
  const [period, setPeriod] = useState(initialPeriod)
  const [projectId, setProjectId] = useState('')
  const [accountId, setAccountId] = useState('')
  const [data, setData] = useState<FinanceOverviewDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [draft, setDraft] = useState<any>(null)
  const [resources, setResources] = useState<{ vehicles: Array<{ id: string; label: string }>; materials: Array<{ id: string; label: string }> }>({ vehicles: [], materials: [] })
  const load = useCallback(async () => {
    setLoading(true);setError('')
    try { const params=new URLSearchParams({from:period.from,to:period.to});if(projectId)params.set('projectId',projectId);if(accountId)params.set('accountId',accountId);const response=await fetch(`/api/finanzen/overview?${params}`,{credentials:'include'});const result=await response.json();if(!response.ok)throw new Error(result.error||'Finanzdaten konnten nicht geladen werden.');setData(result.data) } catch(cause){setError(cause instanceof Error?cause.message:'Finanzdaten konnten nicht geladen werden.')} finally{setLoading(false)}
  },[accountId,period.from,period.to,projectId])
  useEffect(()=>{void load()},[load])
  useEffect(() => {
    void Promise.all([
      fetch('/api/vehicles', { credentials:'include' }).then(async response => response.ok ? await response.json() as { vehicles?: Array<Record<string, unknown>> } : { vehicles: [] }),
      fetch('/api/lager/articles', { credentials:'include' }).then(async response => response.ok ? await response.json() as { articles?: Array<Record<string, unknown>> } : { articles: [] }),
    ]).then(([vehicles, articles]) => setResources({
      vehicles: (vehicles.vehicles || []).map(item => ({ id:String(item._id || item.id), label:`${item.type || 'Fahrzeug'} · ${item.licensePlate || ''}` })),
      materials: (articles.articles || []).map(item => ({ id:String(item._id || item.id), label:`${item.artikelnummer || ''} · ${item.bezeichnung || 'Material'}` })),
    })).catch(() => {})
  }, [])
  const openEntry = (nextDraft:any=null) => {setDraft(nextDraft);setDialogOpen(true)}
  const removeEntry = async (entry:FinanceEntryDto) => { if(!window.confirm(`Buchung „${entry.title}“ wirklich löschen?`))return;const response=await fetchWithIntent(`/api/finanzen/entries/${entry.id}`,{method:'DELETE',intent:'finance:entry:delete'});if(response.ok)await load();else{const result=await response.json();setError(result.error||'Buchung konnte nicht gelöscht werden.')} }

  return <div className="space-y-6 p-4 sm:p-6">
    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between"><div><div className="flex flex-wrap items-center gap-3"><h1 className="text-3xl font-bold tracking-tight text-slate-950 dark:text-white">Finanzen</h1><Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300"><ShieldCheck className="mr-1 h-3.5 w-3.5"/>Nur Super-Admin</Badge></div><p className="mt-1 text-slate-600 dark:text-slate-400">Projektmargen, Personalkosten, Cashflow und Konten in einer gemeinsamen Sicht.</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={()=>void load()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading?'animate-spin':''}`}/>Aktualisieren</Button><Button onClick={()=>openEntry()}><Plus className="mr-2 h-4 w-4"/>Buchung erfassen</Button></div></div>
    <Card className="border-slate-200/80 bg-slate-50/70 dark:border-slate-700 dark:bg-slate-900/40"><CardContent className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1.35fr_1.35fr_auto]"><Filter label="Von"><Input type="date" value={period.from} onChange={event=>setPeriod({...period,from:event.target.value})}/></Filter><Filter label="Bis"><Input type="date" value={period.to} onChange={event=>setPeriod({...period,to:event.target.value})}/></Filter><Filter label="Projekt"><Select value={projectId||'all'} onValueChange={value=>setProjectId(value==='all'?'':value)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">Alle Projekte</SelectItem>{data?.projects.map(item=><SelectItem key={item.projectId} value={item.projectId}>{item.projectName}</SelectItem>)}</SelectContent></Select></Filter><Filter label="Konto"><Select value={accountId||'all'} onValueChange={value=>setAccountId(value==='all'?'':value)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">Alle Konten</SelectItem>{data?.accounts.map(item=><SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></Filter><div className="flex items-end"><Button className="w-full" variant="secondary" onClick={()=>void load()}>Zeitraum anwenden</Button></div></CardContent></Card>
    {error&&<Alert variant="destructive"><AlertTriangle className="h-4 w-4"/><AlertTitle>Finanzdaten nicht verfügbar</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
    {loading&&!data?<Loading/>:data&&<>
      {data.warnings.length>0&&<Alert className="border-amber-200 bg-amber-50/80 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100"><AlertTriangle className="h-4 w-4"/><AlertTitle>{data.warnings.length} Datenhinweis{data.warnings.length!==1?'e':''}</AlertTitle><AlertDescription><details><summary className="cursor-pointer">Zuordnungs- und Konfigurationslücken anzeigen</summary><ul className="mt-2 list-disc space-y-1 pl-5">{data.warnings.map((warning,index)=><li key={`${warning}-${index}`}>{warning}</li>)}</ul></details></AlertDescription></Alert>}
      <FinanceKpiGrid kpis={data.kpis}/>
      <Tabs defaultValue="overview" className="space-y-4"><div className="overflow-x-auto pb-1"><TabsList className="h-auto min-w-max"><TabsTrigger value="overview">Übersicht</TabsTrigger><TabsTrigger value="projects">Projektkosten</TabsTrigger><TabsTrigger value="transactions">Buchungen</TabsTrigger><TabsTrigger value="planning">Limits & Wiederkehrend</TabsTrigger><TabsTrigger value="master">Konten & Lohnsätze</TabsTrigger><TabsTrigger value="ai">KI</TabsTrigger></TabsList></div><TabsContent value="overview"><FinanceCharts data={data}/></TabsContent><TabsContent value="projects"><FinanceProjectTable projects={data.projects}/></TabsContent><TabsContent value="transactions" className="space-y-3"><div className="flex justify-end"><FinanceBankImport accounts={data.accounts} onChanged={()=>void load()}/></div><FinanceTransactionTable entries={data.entries} onDelete={removeEntry}/></TabsContent><TabsContent value="planning"><FinancePlanning data={data} onChanged={()=>void load()}/></TabsContent><TabsContent value="master"><FinanceMasterData data={data} onChanged={()=>void load()}/></TabsContent><TabsContent value="ai"><FinanceAiPanel period={data.period} projectId={projectId||undefined} onReceiptDraft={next=>openEntry(next)}/></TabsContent></Tabs>
      <FinanceEntryDialog open={dialogOpen} onOpenChange={setDialogOpen} overview={data} resources={resources} initialDraft={draft} onSaved={()=>void load()}/>
    </>}
  </div>
}

function Filter({label,children}:{label:string;children:React.ReactNode}){return <div className="space-y-1.5"><Label className="text-xs uppercase tracking-wide text-slate-500">{label}</Label>{children}</div>}
function Loading(){return <div className="space-y-4"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Array.from({length:8},(_,index)=><Skeleton key={index} className="h-28"/>)}</div><div className="grid gap-4 xl:grid-cols-2"><Skeleton className="h-80"/><Skeleton className="h-80"/></div></div>}
