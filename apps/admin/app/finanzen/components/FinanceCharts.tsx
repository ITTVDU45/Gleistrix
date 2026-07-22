"use client"
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { FinanceOverviewDto } from '@/types/finance'
import { formatMoney } from '../financeUi'

const axisMoney = (value: number) => new Intl.NumberFormat('de-DE', { notation: 'compact', maximumFractionDigits: 1 }).format(value / 100)

export function FinanceCharts({ data }: { data: FinanceOverviewDto }) {
  const cash = data.cashSeries.map(point => ({ ...point, Einnahmen: point.incomeCents, Ausgaben: point.expenseCents, Kumuliert: point.cumulativeCents }))
  const margins = data.projects.slice(0, 10).map(project => ({ name: project.projectName, Umsatz: project.actualRevenueCents, Kosten: project.employeeCostCents + project.subcontractorCostCents + project.otherCostCents }))
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Cashflow-Verlauf</CardTitle><CardDescription>Bezahlte Ein- und Ausgänge inklusive kumulierter Entwicklung</CardDescription></CardHeader>
        <CardContent className="h-72 px-2 sm:px-6">
          {cash.length ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={cash} margin={{ left: 2, right: 12, top: 12, bottom: 0 }}><defs><linearGradient id="cashGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#2563eb" stopOpacity={0.28}/><stop offset="95%" stopColor="#2563eb" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700"/><XAxis dataKey="date" tick={{ fontSize: 11 }}/><YAxis tickFormatter={axisMoney} tick={{ fontSize: 11 }}/><Tooltip formatter={(value: number) => formatMoney(value)}/><Area type="monotone" dataKey="Kumuliert" stroke="#2563eb" fill="url(#cashGradient)" strokeWidth={2}/></AreaChart></ResponsiveContainer> : <EmptyChart />}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Projektumsatz und Kosten</CardTitle><CardDescription>Netto-Istwerte für die zehn umsatzstärksten Projekte</CardDescription></CardHeader>
        <CardContent className="h-72 px-2 sm:px-6">
          {margins.some(value => value.Umsatz || value.Kosten) ? <ResponsiveContainer width="100%" height="100%"><BarChart data={margins} margin={{ left: 2, right: 12, top: 12, bottom: 24 }}><CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700"/><XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" height={60}/><YAxis tickFormatter={axisMoney} tick={{ fontSize: 11 }}/><Tooltip formatter={(value: number) => formatMoney(value)}/><Bar dataKey="Umsatz" fill="#2563eb" radius={[4,4,0,0]}/><Bar dataKey="Kosten" fill="#94a3b8" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer> : <EmptyChart />}
        </CardContent>
      </Card>
      <Card className="xl:col-span-2">
        <CardHeader className="pb-2"><CardTitle className="text-base">Kosten nach Kategorie</CardTitle><CardDescription>Ergebniswirksame Nettokosten im gewählten Zeitraum</CardDescription></CardHeader>
        <CardContent className="grid min-h-64 gap-4 md:grid-cols-[280px_1fr]">
          {data.categoryCosts.length ? <><div className="h-60"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data.categoryCosts} dataKey="valueCents" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>{data.categoryCosts.map(item => <Cell key={item.name} fill={item.color}/>)}</Pie><Tooltip formatter={(value: number) => formatMoney(value)}/></PieChart></ResponsiveContainer></div><div className="grid content-center gap-2 sm:grid-cols-2">{data.categoryCosts.map(item => <div key={item.name} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm"><span className="flex min-w-0 items-center gap-2"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }}/><span className="truncate">{item.name}</span></span><span className="font-medium tabular-nums">{formatMoney(item.valueCents)}</span></div>)}</div></> : <div className="md:col-span-2"><EmptyChart /></div>}
        </CardContent>
      </Card>
    </div>
  )
}

function EmptyChart() { return <div className="flex h-full items-center justify-center text-sm text-slate-500">Noch keine Daten im gewählten Zeitraum.</div> }
