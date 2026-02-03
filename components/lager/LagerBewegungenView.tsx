'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Package } from 'lucide-react'
import type { Article } from '@/types/main'
import type { StockMovement } from '@/types/main'
import { LagerApi } from '@/lib/api/lager'

interface LagerBewegungenViewProps {
  articles: Article[]
  onRefresh: () => void
}

export default function LagerBewegungenView({ articles, onRefresh }: LagerBewegungenViewProps) {
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [loading, setLoading] = useState(true)
  const [datumVon, setDatumVon] = useState('')
  const [datumBis, setDatumBis] = useState('')
  const [typFilter, setTypFilter] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const res = await LagerApi.movements.list({
          datumVon: datumVon || undefined,
          datumBis: datumBis || undefined,
          bewegungstyp: typFilter || undefined
        })
        if (!cancelled && res?.success && Array.isArray((res as { movements?: unknown }).movements)) {
          setMovements((res as { movements: StockMovement[] }).movements)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [datumVon, datumBis, typFilter, onRefresh])

  const formatDatum = (d: string | Date | undefined) => {
    if (!d) return '–'
    const date = typeof d === 'string' ? new Date(d) : d
    return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  const getArtikelBezeichnung = (m: StockMovement) => {
    const pop = (m as any).artikelId_populated ?? (m as any).artikelId
    if (pop && typeof pop === 'object' && 'bezeichnung' in pop) return (pop as { bezeichnung?: string }).bezeichnung ?? (pop as { artikelnummer?: string }).artikelnummer ?? '–'
    return '–'
  }

  return (
    <Card className="border-0 shadow-lg bg-white dark:bg-slate-800 rounded-xl">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Bewegungshistorie</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Alle Warenein- und -ausgänge chronologisch
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Input
              type="date"
              placeholder="Von"
              value={datumVon}
              onChange={(e) => setDatumVon(e.target.value)}
              className="w-[140px] rounded-xl h-9"
            />
            <Input
              type="date"
              placeholder="Bis"
              value={datumBis}
              onChange={(e) => setDatumBis(e.target.value)}
              className="w-[140px] rounded-xl h-9"
            />
            <select
              value={typFilter}
              onChange={(e) => setTypFilter(e.target.value)}
              className="h-9 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 text-sm"
            >
              <option value="">Alle Typen</option>
              <option value="eingang">Eingang</option>
              <option value="ausgang">Ausgang</option>
              <option value="korrektur">Korrektur</option>
              <option value="inventur">Inventur</option>
            </select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : movements.length > 0 ? (
          <div className="rounded-xl border border-slate-200 dark:border-slate-600 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 dark:bg-slate-700">
                  <TableHead className="font-medium text-slate-700 dark:text-slate-300">Datum</TableHead>
                  <TableHead className="font-medium text-slate-700 dark:text-slate-300">Artikel</TableHead>
                  <TableHead className="font-medium text-slate-700 dark:text-slate-300">Typ</TableHead>
                  <TableHead className="font-medium text-slate-700 dark:text-slate-300 text-right">Menge</TableHead>
                  <TableHead className="font-medium text-slate-700 dark:text-slate-300">Bemerkung</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.map((m, idx) => (
                  <TableRow key={(m as any)._id ?? idx} className="hover:bg-slate-50 dark:hover:bg-slate-700">
                    <TableCell className="dark:text-slate-300">{formatDatum(m.datum)}</TableCell>
                    <TableCell className="dark:text-white">{getArtikelBezeichnung(m)}</TableCell>
                    <TableCell className="dark:text-slate-300">{m.bewegungstyp}</TableCell>
                    <TableCell className="text-right font-medium dark:text-white">{m.menge}</TableCell>
                    <TableCell className="dark:text-slate-300 max-w-[200px] truncate">{m.bemerkung || '–'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-12">
            <Package className="h-12 w-12 text-slate-400 dark:text-slate-500 mx-auto mb-4" />
            <p className="text-slate-600 dark:text-slate-400">Keine Bewegungen gefunden</p>
            <p className="text-sm text-slate-500 mt-1">Passen Sie die Filter an oder erfassen Sie Warenein-/-ausgänge.</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
