'use client'

import React, { useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import {
  Clock,
  Users,
  Sun,
  Moon,
  Wrench,
  Truck,
  ChevronDown,
} from 'lucide-react'
import HoursByFunctionCard from './HoursByFunctionCard'
import { normalizeTimeEntryToBillingRows } from '@/lib/timeEntry/billingRows'
import { detectEntryShift } from '@/lib/plantafel/projectColors'
import type { HoursByFunctionEntry } from '@/lib/timeEntry/hoursByFunction'
import type { Project } from '../types'

interface ProjectDetailKPIsProps {
  project: Project
}

interface KPICardProps {
  label: string
  value: string | number
  icon: React.ReactNode
  color: string
  sub?: string
}

function KPICard({ label, value, icon, color, sub }: KPICardProps) {
  return (
    <Card className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm ring-1 ring-white dark:border-slate-700 dark:bg-slate-800 dark:ring-slate-700">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              {label}
            </p>
            <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
              {value}
            </p>
            {sub && (
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{sub}</p>
            )}
          </div>
          <div className={`rounded-2xl p-3 ring-1 ${color}`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

interface CollapsibleSectionProps {
  title: string
  icon: React.ReactNode
  color: string
  children: React.ReactNode
  badge?: string
  defaultOpen?: boolean
}

function CollapsibleSection({ title, icon, color, children, badge, defaultOpen = false }: CollapsibleSectionProps) {
  const [open, setOpen] = React.useState(defaultOpen)

  return (
    <Card className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm ring-1 ring-white dark:border-slate-700 dark:bg-slate-800 dark:ring-slate-700">
      <CardContent className="p-5">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-4 text-left"
        >
          <div className="flex items-center gap-3">
            <div className={`rounded-2xl p-3 ring-1 ${color}`}>
              {icon}
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-600 dark:text-slate-300">
              {title}
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {badge && (
              <span className="rounded-full bg-slate-100 dark:bg-slate-700 px-3 py-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                {badge}
              </span>
            )}
            <ChevronDown
              className={`h-5 w-5 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
            />
          </div>
        </button>
        {open && <div className="mt-4">{children}</div>}
      </CardContent>
    </Card>
  )
}

function formatH(hours: number): string {
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  if (m === 60) return `${h + 1}:00`
  return `${h}:${String(m).padStart(2, '0')}`
}

export default function ProjectDetailKPIs({ project }: ProjectDetailKPIsProps) {
  const stats = useMemo(() => {
    const zeiten = project.mitarbeiterZeiten || {}
    const mitarbeiterSet = new Set<string>()
    let totalStunden = 0
    let totalExtra = 0
    let fruehCount = 0
    let nachtCount = 0
    let totalEintraege = 0
    const billingRows: HoursByFunctionEntry[] = []

    for (const [date, entries] of Object.entries(zeiten)) {
      if (!entries) continue
      for (const entry of entries as any[]) {
        const rows = normalizeTimeEntryToBillingRows(date, entry)
        for (const row of rows) {
          if (row.bemerkung?.includes('Fortsetzung vom Vortag')) continue

          totalEintraege++
          const mult = row.isExternal && row.count > 0 ? row.count : 1
          totalStunden += (typeof row.stundenTotal === 'number' ? row.stundenTotal : 0) * mult
          totalExtra += (typeof row.extraTotal === 'number' ? row.extraTotal : 0) * mult

          const shift = detectEntryShift(row.start, row.ende)
          if (shift === 'nacht') nachtCount++
          else fruehCount++

          if (row.isExternal) {
            if (row.companyName) mitarbeiterSet.add(row.companyName)
          } else {
            if (row.employeeName) mitarbeiterSet.add(row.employeeName)
          }

          billingRows.push({
            funktion: row.funktion,
            stunden: row.stundenTotal,
            extra: row.extraTotal,
            fahrtstunden: row.fahrtstundenTotal,
            isExternal: row.isExternal,
            externalCount: row.count,
          })
        }
      }
    }

    const materialMap = new Map<string, number>()
    const technik = project.technik || {}
    if (typeof technik === 'object') {
      for (const entries of Object.values(technik)) {
        if (!Array.isArray(entries)) continue
        for (const t of entries) {
          const name = String(t.name || 'Unbekannt').trim()
          const anzahl = typeof t.anzahl === 'number' ? t.anzahl : 1
          materialMap.set(name, (materialMap.get(name) || 0) + anzahl)
        }
      }
    }
    const materialList = Array.from(materialMap.entries())
      .map(([name, anzahl]) => ({ name, anzahl }))
      .sort((a, b) => b.anzahl - a.anzahl)

    const fahrzeugSet = new Map<string, number>()
    const fzg = (project as any).fahrzeuge || {}
    if (typeof fzg === 'object') {
      for (const entries of Object.values(fzg)) {
        if (!Array.isArray(entries)) continue
        for (const f of entries) {
          const name = String(f.kennzeichen || f.name || f.fahrzeugId || 'Unbekannt').trim()
          fahrzeugSet.set(name, (fahrzeugSet.get(name) || 0) + 1)
        }
      }
    }
    const fahrzeugList = Array.from(fahrzeugSet.entries())
      .map(([name, tage]) => ({ name, tage }))
      .sort((a, b) => b.tage - a.tage)

    return {
      totalStunden,
      totalExtra,
      fruehCount,
      nachtCount,
      totalEintraege,
      mitarbeiterCount: mitarbeiterSet.size,
      materialList,
      materialTotal: materialList.reduce((s, m) => s + m.anzahl, 0),
      fahrzeugList,
      fahrzeugTotal: fahrzeugSet.size,
      billingRows,
    }
  }, [project])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KPICard
          label="Stunden"
          value={formatH(stats.totalStunden)}
          icon={<Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />}
          color="bg-blue-50 ring-blue-100 dark:bg-blue-900/30 dark:ring-blue-800"
          sub={stats.totalExtra > 0 ? `+ ${formatH(stats.totalExtra)} Extra` : undefined}
        />
        <KPICard
          label="Mitarbeiter"
          value={stats.mitarbeiterCount}
          icon={<Users className="h-5 w-5 text-violet-600 dark:text-violet-400" />}
          color="bg-violet-50 ring-violet-100 dark:bg-violet-900/30 dark:ring-violet-800"
          sub={`${stats.totalEintraege} Einträge`}
        />
        <KPICard
          label="Frühschichten"
          value={stats.fruehCount}
          icon={<Sun className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />}
          color="bg-emerald-50 ring-emerald-100 dark:bg-emerald-900/30 dark:ring-emerald-800"
        />
        <KPICard
          label="Nachtschichten"
          value={stats.nachtCount}
          icon={<Moon className="h-5 w-5 text-red-600 dark:text-red-400" />}
          color="bg-red-50 ring-red-100 dark:bg-red-900/30 dark:ring-red-800"
        />
        <KPICard
          label="Material"
          value={stats.materialTotal}
          icon={<Wrench className="h-5 w-5 text-amber-600 dark:text-amber-400" />}
          color="bg-amber-50 ring-amber-100 dark:bg-amber-900/30 dark:ring-amber-800"
          sub={`${stats.materialList.length} Typen`}
        />
        <KPICard
          label="Fahrzeuge"
          value={stats.fahrzeugTotal}
          icon={<Truck className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />}
          color="bg-cyan-50 ring-cyan-100 dark:bg-cyan-900/30 dark:ring-cyan-800"
          sub={`${stats.fahrzeugList.reduce((s, f) => s + f.tage, 0)} Einsatztage`}
        />
      </div>

      {stats.materialList.length > 0 && (
        <CollapsibleSection
          title="Material-Übersicht"
          icon={<Wrench className="h-5 w-5 text-amber-600 dark:text-amber-400" />}
          color="bg-amber-50 ring-amber-100 dark:bg-amber-900/30 dark:ring-amber-800"
          badge={`${stats.materialTotal} gesamt`}
        >
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <th className="pb-2 font-medium">Name</th>
                <th className="pb-2 font-medium text-right">Anzahl</th>
              </tr>
            </thead>
            <tbody>
              {stats.materialList.map((m) => (
                <tr key={m.name} className="border-t border-slate-100 dark:border-slate-700/60">
                  <td className="py-1.5 text-slate-800 dark:text-slate-200">{m.name}</td>
                  <td className="py-1.5 text-right font-semibold text-slate-900 dark:text-white tabular-nums">
                    {m.anzahl}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CollapsibleSection>
      )}

      {stats.fahrzeugList.length > 0 && (
        <CollapsibleSection
          title="Fahrzeug-Übersicht"
          icon={<Truck className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />}
          color="bg-cyan-50 ring-cyan-100 dark:bg-cyan-900/30 dark:ring-cyan-800"
          badge={`${stats.fahrzeugTotal} Fahrzeuge`}
        >
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <th className="pb-2 font-medium">Kennzeichen</th>
                <th className="pb-2 font-medium text-right">Einsatztage</th>
              </tr>
            </thead>
            <tbody>
              {stats.fahrzeugList.map((f) => (
                <tr key={f.name} className="border-t border-slate-100 dark:border-slate-700/60">
                  <td className="py-1.5 text-slate-800 dark:text-slate-200">{f.name}</td>
                  <td className="py-1.5 text-right font-semibold text-slate-900 dark:text-white tabular-nums">
                    {f.tage}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CollapsibleSection>
      )}

      <HoursByFunctionCard timeEntries={stats.billingRows} />
    </div>
  )
}
