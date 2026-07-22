import type { LucideIcon } from 'lucide-react'
import { ArrowDownRight, ArrowUpRight, Banknote, BriefcaseBusiness, Building2, Landmark, TrendingUp, Users } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import type { FinanceOverviewDto } from '@/types/finance'
import { formatMoney } from '../financeUi'

export function FinanceKpiGrid({ kpis }: { kpis: FinanceOverviewDto['kpis'] }) {
  const items: Array<{ label: string; value: number; icon: LucideIcon; tone: string; hint: string }> = [
    { label: 'Liquidität', value: kpis.liquidityCents, icon: Landmark, tone: 'text-blue-600 bg-blue-50 dark:bg-blue-950/40', hint: 'Aktive Konten' },
    { label: 'Einzahlungen', value: kpis.cashInCents, icon: ArrowDownRight, tone: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40', hint: 'Brutto, bezahlt' },
    { label: 'Auszahlungen', value: kpis.cashOutCents, icon: ArrowUpRight, tone: 'text-rose-600 bg-rose-50 dark:bg-rose-950/40', hint: 'Brutto, bezahlt' },
    { label: 'Cashflow', value: kpis.cashflowCents, icon: TrendingUp, tone: 'text-cyan-600 bg-cyan-50 dark:bg-cyan-950/40', hint: 'Ein- minus Auszahlungen' },
    { label: 'Ist-Umsatz', value: kpis.actualRevenueCents, icon: Banknote, tone: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40', hint: 'Netto, Ergebnis' },
    { label: 'Interne Personalkosten', value: kpis.employeeCostCents, icon: Users, tone: 'text-violet-600 bg-violet-50 dark:bg-violet-950/40', hint: 'Aus bestätigten Zeiten' },
    { label: 'Subunternehmerkosten', value: kpis.subcontractorCostCents, icon: Building2, tone: 'text-fuchsia-600 bg-fuchsia-50 dark:bg-fuchsia-950/40', hint: 'Schätzung oder Rechnung' },
    { label: 'Projektergebnis', value: kpis.projectResultCents, icon: BriefcaseBusiness, tone: kpis.projectResultCents >= 0 ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40' : 'text-rose-600 bg-rose-50 dark:bg-rose-950/40', hint: 'Umsatz minus Kosten' },
  ]
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map(({ label, value, icon: Icon, tone, hint }) => (
        <Card key={label} className="border-slate-200/80 dark:border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
                <p className="mt-2 text-xl font-semibold tabular-nums text-slate-950 dark:text-white">{formatMoney(value)}</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p>
              </div>
              <span className={`rounded-lg p-2 ${tone}`}><Icon className="h-4 w-4" /></span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
