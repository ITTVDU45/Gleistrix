'use client'

import { useEffect, useState } from 'react'
import { BarChart3 } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import DynamicIcon from '@/components/shared/DynamicIcon'
import ReportSection from './ReportSection'
import { REPORT_TABS } from '@/lib/mock/reports'
import { ReportsApi } from '@/lib/api/reports'
import type { ReportOverview, ReportTabId } from '@/types/reports'

const CATEGORY_TITLES: Partial<Record<ReportTabId, string>> = {
  lager: 'Bewegungen',
  qualitaet: 'Mängel nach Bereich',
  projekte: 'Kennzahlen',
  mitarbeiter: 'Kennzahlen',
  einsaetze: 'Kennzahlen',
}

export default function ReportsClient() {
  const [overview, setOverview] = useState<ReportOverview | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<ReportTabId>(REPORT_TABS[0]?.id ?? 'allgemein')

  useEffect(() => {
    let cancelled = false
    ReportsApi.getReportOverview()
      .then((data) => {
        if (!cancelled) setOverview(data)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Statistiken &amp; Reports</h1>
          <p className="mt-1 text-slate-600 dark:text-slate-400">
            Zentrale Reporting- und Analyseoberfläche für Gleistrix
          </p>
        </div>
        <div className="hidden rounded-2xl bg-blue-50 p-3 ring-1 ring-blue-100 dark:bg-blue-900/30 dark:ring-blue-800 sm:block">
          <BarChart3 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ReportTabId)} className="w-full">
        {/* Tab-Leiste: horizontal scrollbar für viele/erweiterbare Tabs */}
        <div className="-mx-1 overflow-x-auto pb-1">
          <TabsList className="inline-flex h-auto w-max flex-nowrap gap-1 bg-slate-100 p-1 dark:bg-slate-800">
            {REPORT_TABS.map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id} className="gap-1.5 whitespace-nowrap text-xs">
                <DynamicIcon name={tab.icon} className="h-3.5 w-3.5" />
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {REPORT_TABS.map((tab) => (
          <TabsContent key={tab.id} value={tab.id} className="mt-5">
            {tab.description && (
              <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">{tab.description}</p>
            )}
            <ReportSection
              data={overview?.[tab.id]}
              isLoading={isLoading}
              categoryTitle={CATEGORY_TITLES[tab.id] ?? 'Verteilung'}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
