'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { UserCheck, ArrowLeft, Package, Layers } from 'lucide-react'
import type { Article } from '@/types/main'
import { LagerApi } from '@/lib/api/lager'
import { useEmployees } from '@/hooks/useEmployees'
import AusgabeDialog from './AusgabeDialog'
import SammelausgabeDialog from './SammelausgabeDialog'
import RuecknahmeDialog from './RuecknahmeDialog'

interface AssignmentRow {
  _id: string
  artikelId: { bezeichnung?: string; artikelnummer?: string } | string
  personId: { name?: string } | string
  menge: number
  ausgabedatum: string
  geplanteRueckgabe?: string | null
  status: string
}

interface LagerAusgabeViewProps {
  articles: Article[]
  onRefresh: () => void
}

export default function LagerAusgabeView({ articles, onRefresh }: LagerAusgabeViewProps) {
  const [assignments, setAssignments] = useState<AssignmentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [ausgabeOpen, setAusgabeOpen] = useState(false)
  const [sammelausgabeOpen, setSammelausgabeOpen] = useState(false)
  const [ruecknahmeOpen, setRuecknahmeOpen] = useState(false)
  const { employees } = useEmployees()

  const loadAssignments = async () => {
    setLoading(true)
    try {
      const res = await LagerApi.assignments.list({ status: 'ausgegeben' })
      if (res?.success && res.assignments) {
        setAssignments(res.assignments as AssignmentRow[])
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAssignments()
  }, [onRefresh])

  const formatDatum = (d: string | undefined) => {
    if (!d) return '–'
    return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  const getArtikelName = (a: { bezeichnung?: string; artikelnummer?: string } | string) => {
    if (typeof a === 'object' && a?.bezeichnung) return a.bezeichnung
    if (typeof a === 'object' && a?.artikelnummer) return a.artikelnummer
    return '–'
  }
  const getPersonName = (p: { name?: string } | string) => {
    if (typeof p === 'object' && p?.name) return p.name
    return '–'
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const isUeberfaellig = (row: AssignmentRow) =>
    row.status === 'ausgegeben' &&
    row.geplanteRueckgabe != null &&
    row.geplanteRueckgabe !== '' &&
    new Date(row.geplanteRueckgabe).setHours(0, 0, 0, 0) < today.getTime()

  const activeArticles = articles.filter((a) => (a.status ?? 'aktiv') === 'aktiv' && (a.bestand ?? 0) > 0)

  return (
    <>
      <Card className="border-0 shadow-lg bg-white dark:bg-slate-800 rounded-xl">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Ausgabe & Rücknahme</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                Artikel an Mitarbeiter ausgeben und zurückbuchen
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="default"
                className="gap-2 bg-blue-600 hover:bg-blue-700"
                onClick={() => setAusgabeOpen(true)}
              >
                <UserCheck className="h-4 w-4" />
                Ausgabe
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => setSammelausgabeOpen(true)}
              >
                <Layers className="h-4 w-4" />
                Sammelausgabe
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => setRuecknahmeOpen(true)}
              >
                <ArrowLeft className="h-4 w-4" />
                Rücknahme
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Offene Ausgaben</h3>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
            </div>
          ) : assignments.length > 0 ? (
            <div className="rounded-xl border border-slate-200 dark:border-slate-600 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 dark:bg-slate-700">
                    <TableHead className="font-medium text-slate-700 dark:text-slate-300">Artikel</TableHead>
                    <TableHead className="font-medium text-slate-700 dark:text-slate-300">Mitarbeiter</TableHead>
                    <TableHead className="font-medium text-slate-700 dark:text-slate-300">Menge</TableHead>
                    <TableHead className="font-medium text-slate-700 dark:text-slate-300">Ausgabedatum</TableHead>
                    <TableHead className="font-medium text-slate-700 dark:text-slate-300">Geplante Rückgabe</TableHead>
                    <TableHead className="font-medium text-slate-700 dark:text-slate-300 w-[120px]">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignments.map((a) => (
                    <TableRow
                      key={a._id}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-700 ${isUeberfaellig(a) ? 'bg-red-50/50 dark:bg-red-900/10' : ''}`}
                    >
                      <TableCell className="dark:text-white">{getArtikelName(a.artikelId as any)}</TableCell>
                      <TableCell className="dark:text-slate-300">{getPersonName(a.personId as any)}</TableCell>
                      <TableCell className="dark:text-slate-300">{a.menge}</TableCell>
                      <TableCell className="dark:text-slate-300">{formatDatum(a.ausgabedatum)}</TableCell>
                      <TableCell className="dark:text-slate-300">{formatDatum(a.geplanteRueckgabe ?? undefined)}</TableCell>
                      <TableCell>
                        {isUeberfaellig(a) ? (
                          <Badge variant="destructive">Überfällig</Badge>
                        ) : (
                          <span className="text-slate-500 dark:text-slate-400 text-sm">–</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500 dark:text-slate-400 text-sm">
              <Package className="h-10 w-10 mx-auto mb-2 opacity-50" />
              Keine offenen Ausgaben. Nutzen Sie „Ausgabe“, um Artikel an Mitarbeiter zu vergeben.
            </div>
          )}
        </CardContent>
      </Card>

      <AusgabeDialog
        open={ausgabeOpen}
        onOpenChange={setAusgabeOpen}
        articles={activeArticles}
        employees={employees}
        onSuccess={() => {
          onRefresh()
          loadAssignments()
        }}
      />
      <SammelausgabeDialog
        open={sammelausgabeOpen}
        onOpenChange={setSammelausgabeOpen}
        articles={activeArticles}
        employees={employees}
        onSuccess={() => {
          onRefresh()
          loadAssignments()
        }}
      />
      <RuecknahmeDialog
        open={ruecknahmeOpen}
        onOpenChange={setRuecknahmeOpen}
        assignments={assignments}
        onSuccess={() => {
          onRefresh()
          loadAssignments()
        }}
      />
    </>
  )
}
