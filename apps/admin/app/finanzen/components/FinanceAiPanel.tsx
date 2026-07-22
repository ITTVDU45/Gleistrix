"use client"
import { useCallback, useEffect, useState } from 'react'
import { Bot, FileScan, Loader2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { fetchWithIntent } from '@/lib/http/fetchWithIntent'
import type { FinanceOverviewDto } from '@/types/finance'
import { formatDate } from '../financeUi'

interface AiReport { _id:string; title:string; content:string; model:string; createdAt:string }

export function FinanceAiPanel({ period, projectId, onReceiptDraft }: { period: FinanceOverviewDto['period']; projectId?: string; onReceiptDraft: (draft:any) => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [reports, setReports] = useState<AiReport[]>([])
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')
  const load = useCallback(async () => { const response=await fetch('/api/finanzen/ai/reports',{credentials:'include'}); if(response.ok){const result=await response.json();setReports(result.data||[])} },[])
  useEffect(()=>{void load()},[load])
  const extract = async () => {
    if(!file) return
    setBusy('extract');setMessage('')
    try { const form=new FormData();form.append('file',file);const response=await fetchWithIntent('/api/finanzen/ai/extract',{method:'POST',intent:'finance:ai-extract',body:form});const result=await response.json();if(!response.ok)throw new Error(result.data?.reason||result.error);onReceiptDraft(result.data.draft) } catch(cause){setMessage(cause instanceof Error?cause.message:'Beleganalyse fehlgeschlagen.')} finally{setBusy('')}
  }
  const report = async () => {
    setBusy('report');setMessage('')
    try { const response=await fetchWithIntent('/api/finanzen/ai/reports',{method:'POST',intent:'finance:ai-report',body:JSON.stringify({from:period.from.slice(0,10),to:period.to.slice(0,10),projectId})});const result=await response.json();if(!response.ok)throw new Error(result.data?.reason||result.error);await load() } catch(cause){setMessage(cause instanceof Error?cause.message:'Bericht konnte nicht erstellt werden.')} finally{setBusy('')}
  }
  return <div className="grid gap-4 xl:grid-cols-2"><Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><FileScan className="h-4 w-4 text-blue-600"/>KI-Belegerfassung</CardTitle><CardDescription>PDF, JPEG, PNG oder WebP bis 10 MB. Es wird nur ein prüfbarer Formularentwurf erzeugt.</CardDescription></CardHeader><CardContent className="space-y-4"><Input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={event=>setFile(event.target.files?.[0]||null)}/><Button onClick={extract} disabled={!file||busy==='extract'}>{busy==='extract'?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:<Sparkles className="mr-2 h-4 w-4"/>}Beleg analysieren</Button><p className="text-xs text-slate-500">Extrahierte Daten werden nicht automatisch gebucht. Erst Ihre Bestätigung im Buchungsdialog speichert sie.</p></CardContent></Card><Card><CardHeader className="flex-row items-start justify-between"><div><CardTitle className="flex items-center gap-2 text-base"><Bot className="h-4 w-4 text-blue-600"/>Finanzberichte</CardTitle><CardDescription>Aggregierte KPIs, Projekte und Budgetdaten – keine einzelnen Lohndaten</CardDescription></div><Button size="sm" onClick={report} disabled={busy==='report'}>{busy==='report'&&<Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Bericht erstellen</Button></CardHeader><CardContent className="space-y-3">{reports.length?reports.map(item=><details key={item._id} className="rounded-lg border p-3"><summary className="cursor-pointer list-none"><p className="font-medium">{item.title}</p><p className="mt-1 text-xs text-slate-500">{formatDate(item.createdAt)} · {item.model}</p></summary><div className="mt-3 whitespace-pre-wrap border-t pt-3 text-sm leading-6 text-slate-700 dark:text-slate-300">{item.content}</div></details>):<div className="rounded-lg border border-dashed p-8 text-center text-sm text-slate-500">Noch keine gespeicherten KI-Berichte.</div>}</CardContent></Card>{message&&<div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-200 xl:col-span-2">{message}</div>}</div>
}
