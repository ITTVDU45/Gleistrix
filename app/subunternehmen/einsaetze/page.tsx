"use client";
import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { logger } from '@/lib/logger'
import { getErrorMessage } from '@/lib/errors'
import { SubPortalApi } from '@/lib/api/subunternehmenPortal'
import type { SubcontractorAssignment, SubcontractorAssignmentStatus } from '@/types/subunternehmen'
import { ASSIGNMENT_STATUS_META, formatDate, formatHours } from '@/lib/subunternehmen/format'
import { sumAssignments } from '@/lib/subunternehmen/assignments'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Clock, FilterX } from 'lucide-react'

const ALL = 'alle'

type GroupMode = 'projekt' | 'monat' | 'keine'

export default function PortalEinsaetzePage() {
  const [assignments, setAssignments] = useState<SubcontractorAssignment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  const [projectFilter, setProjectFilter] = useState(ALL)
  const [statusFilter, setStatusFilter] = useState(ALL)
  const [roleFilter, setRoleFilter] = useState(ALL)
  const [billableFilter, setBillableFilter] = useState(ALL)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [groupMode, setGroupMode] = useState<GroupMode>('projekt')

  useEffect(() => {
    const load = async () => {
      try {
        const data = await SubPortalApi.assignments()
        setAssignments(data.assignments || [])
      } catch (err) {
        logger.error('Portal: Einsätze konnten nicht geladen werden', err)
        setError(getErrorMessage(err))
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [])

  const projects = useMemo(() => {
    const map = new Map<string, string>()
    assignments.forEach((a) => map.set(a.projectId, a.projectName))
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1], 'de'))
  }, [assignments])

  const roles = useMemo(
    () => Array.from(new Set(assignments.map((a) => a.funktion))).sort((a, b) => a.localeCompare(b, 'de')),
    [assignments]
  )

  const filtered = useMemo(() => {
    return assignments.filter((a) => {
      if (projectFilter !== ALL && a.projectId !== projectFilter) return false
      if (statusFilter !== ALL && a.status !== statusFilter) return false
      if (roleFilter !== ALL && a.funktion !== roleFilter) return false
      if (billableFilter === 'abrechenbar' && a.status !== 'bestaetigt') return false
      if (billableFilter === 'abgerechnet' && a.status !== 'vollstaendig_abgerechnet') return false
      if (dateFrom && a.day < dateFrom) return false
      if (dateTo && a.day > dateTo) return false
      return true
    })
  }, [assignments, projectFilter, statusFilter, roleFilter, billableFilter, dateFrom, dateTo])

  const sums = useMemo(() => sumAssignments(filtered), [filtered])

  const groups = useMemo(() => {
    if (groupMode === 'keine') return [{ key: 'alle', label: null as string | null, items: filtered }]
    const map = new Map<string, { label: string; items: SubcontractorAssignment[] }>()
    for (const a of filtered) {
      const key = groupMode === 'projekt' ? a.projectId : a.day.slice(0, 7)
      const label = groupMode === 'projekt'
        ? `${a.projectName}${a.projectNumber ? ` (${a.projectNumber})` : ''}`
        : new Date(`${a.day.slice(0, 7)}-01`).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
      const entry = map.get(key) || { label, items: [] }
      entry.items.push(a)
      map.set(key, entry)
    }
    return Array.from(map.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, v]) => ({ key, label: v.label, items: v.items }))
  }, [filtered, groupMode])

  const resetFilters = () => {
    setProjectFilter(ALL)
    setStatusFilter(ALL)
    setRoleFilter(ALL)
    setBillableFilter(ALL)
    setDateFrom('')
    setDateTo('')
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">Einsätze & Stunden</h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">
          Alle disponierten Einsätze Ihres Unternehmens – bestätigte Werte sind Grundlage der Abrechnung
        </p>
      </div>

      {error && (
        <Alert variant="destructive" className="rounded-xl">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Summen */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Einsätze', value: String(sums.einsaetze) },
          { label: 'Mitarbeiter', value: String(sums.mitarbeiter) },
          { label: 'Stunden', value: formatHours(sums.stunden) },
          { label: 'Nachtstunden', value: formatHours(sums.nachtzulage) },
          { label: 'Sonntagsstunden', value: formatHours(sums.sonntagsstunden) },
          { label: 'Feiertagsstunden', value: formatHours(sums.feiertag) },
        ].map((kpi) => (
          <Card key={kpi.label} className="border-0 shadow bg-white/80 dark:bg-slate-800/80 backdrop-blur rounded-xl">
            <CardContent className="p-4 text-center">
              <p className="text-lg font-bold text-slate-900 dark:text-white">{kpi.value}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{kpi.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter */}
      <Card className="border-0 shadow-lg bg-white dark:bg-slate-800 rounded-2xl">
        <CardHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="Projekt" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Alle Projekte</SelectItem>
                {projects.map(([id, name]) => (
                  <SelectItem key={id} value={id}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Alle Status</SelectItem>
                {(Object.keys(ASSIGNMENT_STATUS_META) as SubcontractorAssignmentStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>{ASSIGNMENT_STATUS_META[s].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="Rolle" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Alle Rollen</SelectItem>
                {roles.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={billableFilter} onValueChange={setBillableFilter}>
              <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="Abrechnung" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Alle</SelectItem>
                <SelectItem value="abrechenbar">Noch abrechenbar</SelectItem>
                <SelectItem value="abgerechnet">Bereits abgerechnet</SelectItem>
              </SelectContent>
            </Select>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-10 rounded-xl" />
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-10 rounded-xl" />
            <div className="flex gap-2">
              <Select value={groupMode} onValueChange={(v) => setGroupMode(v as GroupMode)}>
                <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="projekt">Nach Projekt</SelectItem>
                  <SelectItem value="monat">Nach Monat</SelectItem>
                  <SelectItem value="keine">Ohne Gruppierung</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl shrink-0" onClick={resetFilters} title="Filter zurücksetzen">
                <FilterX className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="h-10 w-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-slate-500 dark:text-slate-400">Keine Einsätze für die gewählten Filter.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {groups.map((group) => {
                const groupSums = sumAssignments(group.items)
                return (
                  <div key={group.key}>
                    {group.label && (
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold text-slate-800 dark:text-slate-200">{group.label}</h4>
                        <span className="text-sm text-slate-500 dark:text-slate-400">
                          {group.items.length} Einsätze · {formatHours(groupSums.stunden)}
                        </span>
                      </div>
                    )}
                    <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-700">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Datum</TableHead>
                            <TableHead>Projekt</TableHead>
                            <TableHead>Rolle</TableHead>
                            <TableHead className="text-right">MA</TableHead>
                            <TableHead>Start</TableHead>
                            <TableHead>Ende</TableHead>
                            <TableHead>Pause</TableHead>
                            <TableHead className="text-right">Std.</TableHead>
                            <TableHead className="text-right">Nacht</TableHead>
                            <TableHead className="text-right">So.</TableHead>
                            <TableHead className="text-right">Feiert.</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Rechnung</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {group.items.map((a) => {
                            const meta = ASSIGNMENT_STATUS_META[a.status]
                            return (
                              <TableRow key={a.assignmentKey} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                <TableCell className="whitespace-nowrap">{formatDate(a.day)}</TableCell>
                                <TableCell>
                                  <Link
                                    href={`/subunternehmen/projekte/${a.projectId}`}
                                    className="text-blue-600 dark:text-blue-400 hover:underline"
                                  >
                                    {a.projectName}
                                  </Link>
                                </TableCell>
                                <TableCell>{a.funktion}</TableCell>
                                <TableCell className="text-right">{a.count}</TableCell>
                                <TableCell>{a.start || '–'}</TableCell>
                                <TableCell>{a.ende || '–'}</TableCell>
                                <TableCell>{a.pause || '–'}</TableCell>
                                <TableCell className="text-right whitespace-nowrap">{formatHours(a.stundenTotal)}</TableCell>
                                <TableCell className="text-right whitespace-nowrap">{formatHours(a.nachtzulageTotal)}</TableCell>
                                <TableCell className="text-right whitespace-nowrap">{formatHours(a.sonntagsstundenTotal)}</TableCell>
                                <TableCell className="text-right whitespace-nowrap">{formatHours(a.feiertagTotal)}</TableCell>
                                <TableCell>
                                  <Badge className={`rounded-lg px-2 py-0.5 text-xs ${meta.className}`}>{meta.label}</Badge>
                                </TableCell>
                                <TableCell className="text-xs">
                                  {a.invoiceNumbers?.length ? (
                                    <span className="font-mono">{a.invoiceNumbers.join(', ')}</span>
                                  ) : (
                                    <span className="text-slate-400">–</span>
                                  )}
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
