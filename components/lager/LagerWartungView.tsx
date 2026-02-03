'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Wrench, Plus, CheckCircle, FileDown } from 'lucide-react'
import type { Article } from '@/types/main'
import { LagerApi } from '@/lib/api/lager'
import AddMaintenanceDialog from './AddMaintenanceDialog'
import PerformMaintenanceDialog from './PerformMaintenanceDialog'

interface MaintenanceRow {
  _id: string
  artikelId: { bezeichnung?: string; artikelnummer?: string }
  wartungsart: string
  faelligkeitsdatum: string
  durchfuehrungsdatum?: string | null
  status: string
}

interface LagerWartungViewProps {
  articles: Article[]
  onRefresh: () => void
}

type FilterStatus = 'alle' | 'faellig' | 'geplant' | 'erledigt'

export default function LagerWartungView({ articles, onRefresh }: LagerWartungViewProps) {
  const [list, setList] = useState<MaintenanceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterStatus>('alle')
  const [addOpen, setAddOpen] = useState(false)
  const [performId, setPerformId] = useState<string | null>(null)

  const loadList = async () => {
    setLoading(true)
    try {
      const res = await LagerApi.maintenance.list()
      if (res?.success && (res as { maintenance?: MaintenanceRow[] }).maintenance) {
        setList((res as { maintenance: MaintenanceRow[] }).maintenance)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadList()
  }, [onRefresh])

  const today = new Date().toISOString().slice(0, 10)
  const filtered = list.filter((row) => {
    if (filter === 'alle') return true
    if (filter === 'erledigt') return row.status === 'durchgefuehrt' || row.status === 'nicht_bestanden'
    if (filter === 'geplant') return row.status === 'geplant'
    if (filter === 'faellig') {
      return (row.status === 'geplant' || row.status === 'faellig') && row.faelligkeitsdatum <= today
    }
    return true
  })

  const formatDatum = (d: string | undefined) => {
    if (!d) return '–'
    return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  const statusLabel: Record<string, string> = {
    geplant: 'Geplant',
    faellig: 'Fällig',
    durchgefuehrt: 'Durchgeführt',
    nicht_bestanden: 'Nicht bestanden'
  }

  const statusVariant: Record<string, 'secondary' | 'destructive' | 'default' | 'outline'> = {
    geplant: 'secondary',
    faellig: 'destructive',
    durchgefuehrt: 'default',
    nicht_bestanden: 'outline'
  }

  const canPerform = (row: MaintenanceRow) =>
    row.status !== 'durchgefuehrt' && row.status !== 'nicht_bestanden'

  return (
    <>
      <Card className="border-0 shadow-lg bg-white dark:bg-slate-800 rounded-xl">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Wartungen</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                Fällige und geplante Wartungen verwalten
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={filter} onValueChange={(v) => setFilter(v as FilterStatus)}>
                <SelectTrigger className="w-[140px] rounded-xl h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="alle">Alle</SelectItem>
                  <SelectItem value="faellig">Fällig</SelectItem>
                  <SelectItem value="geplant">Geplant</SelectItem>
                  <SelectItem value="erledigt">Erledigt</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => window.open('/api/lager/maintenance/export-pdf', '_blank', 'noopener,noreferrer')}
              >
                <FileDown className="h-4 w-4" />
                Wartungsbericht (PDF)
              </Button>
              <Button variant="default" className="gap-2 bg-blue-600 hover:bg-blue-700" onClick={() => setAddOpen(true)}>
                <Plus className="h-4 w-4" />
                Wartung anlegen
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-slate-500 py-4">Lade Wartungen…</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-slate-500 py-4">Keine Einträge.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Artikel</TableHead>
                  <TableHead>Wartungsart</TableHead>
                  <TableHead>Fällig am</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]">Aktion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row) => (
                  <TableRow key={row._id}>
                    <TableCell>
                      {(row.artikelId as { artikelnummer?: string })?.artikelnummer ?? ''} –{' '}
                      {(row.artikelId as { bezeichnung?: string })?.bezeichnung ?? '–'}
                    </TableCell>
                    <TableCell>{row.wartungsart}</TableCell>
                    <TableCell>{formatDatum(row.faelligkeitsdatum)}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[row.status] ?? 'secondary'}>
                        {statusLabel[row.status] ?? row.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {canPerform(row) && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          onClick={() => setPerformId(row._id)}
                        >
                          <CheckCircle className="h-3 w-3" />
                          Durchführen
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <AddMaintenanceDialog open={addOpen} onOpenChange={setAddOpen} articles={articles} onSuccess={loadList} />
      <PerformMaintenanceDialog
        open={performId !== null}
        onOpenChange={(open) => !open && setPerformId(null)}
        maintenanceId={performId}
        onSuccess={loadList}
      />
    </>
  )
}
