'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ClipboardCheck, Plus, CheckCircle, FileDown } from 'lucide-react'
import type { Article } from '@/types/main'
import { LagerApi } from '@/lib/api/lager'

interface InventoryItem {
  _id: string
  typ: string
  stichtag: string
  status: string
  positionen?: { artikelId: any; sollMenge: number; istMenge: number; differenz: number }[]
}

interface LagerInventurViewProps {
  articles: Article[]
  onRefresh: () => void
}

export default function LagerInventurView({ articles, onRefresh }: LagerInventurViewProps) {
  const [list, setList] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<InventoryItem | null>(null)
  const [istMengen, setIstMengen] = useState<Record<string, number>>({})
  const [saving, setSaving] = useState(false)
  const [completing, setCompleting] = useState(false)

  const loadList = async () => {
    setLoading(true)
    try {
      const res = await LagerApi.inventory.list()
      if (res?.success && res.inventory) {
        setList(res.inventory as InventoryItem[])
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadList()
  }, [onRefresh])

  useEffect(() => {
    if (!selectedId) {
      setDetail(null)
      setIstMengen({})
      return
    }
    let cancelled = false
    LagerApi.inventory.get(selectedId).then((res) => {
      if (!cancelled && (res as any)?.success && (res as any).data) {
        const d = (res as any).data as InventoryItem
        setDetail(d)
        const next: Record<string, number> = {}
        ;(d.positionen ?? []).forEach((p: { artikelId: { _id?: string }; istMenge: number }) => {
          const id = (p.artikelId as any)?._id?.toString?.() ?? (p.artikelId as any)?.toString?.()
          if (id) next[id] = p.istMenge
        })
        setIstMengen(next)
      }
    })
    return () => { cancelled = true }
  }, [selectedId])

  const handleCreate = async () => {
    setSaving(true)
    try {
      const res = await LagerApi.inventory.create({
        typ: 'voll',
        stichtag: new Date().toISOString().slice(0, 10)
      })
      if ((res as any)?.success && (res as any).data) {
        setCreateOpen(false)
        loadList()
        setSelectedId((res as any).data._id)
      }
    } finally {
      setSaving(false)
    }
  }

  const handleSavePositionen = async () => {
    if (!selectedId || !detail) return
    const positionen = (detail.positionen ?? []).map((p: { artikelId: { _id?: string } | string }) => {
      const art = p.artikelId
      const id = typeof art === 'object' && art?._id ? String(art._id) : (typeof art === 'string' ? art : '')
      return { artikelId: id, istMenge: istMengen[id] ?? 0 }
    })
    setSaving(true)
    try {
      await LagerApi.inventory.update(selectedId, { positionen })
      const res = await LagerApi.inventory.get(selectedId)
      if ((res as any)?.success && (res as any).data) setDetail((res as any).data)
      onRefresh()
    } finally {
      setSaving(false)
    }
  }

  const handleComplete = async () => {
    if (!selectedId) return
    setCompleting(true)
    try {
      await LagerApi.inventory.complete(selectedId)
      setSelectedId(null)
      setDetail(null)
      loadList()
      onRefresh()
    } finally {
      setCompleting(false)
    }
  }

  const formatDatum = (d: string) => new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })

  return (
    <>
      <Card className="border-0 shadow-lg bg-white dark:bg-slate-800 rounded-xl">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Inventur</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                Vollinventur anlegen, zählen und abschließen
              </p>
            </div>
            <Button
              variant="default"
              className="gap-2 bg-blue-600 hover:bg-blue-700"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="h-4 w-4" />
              Inventur anlegen
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
            </div>
          ) : list.length > 0 ? (
            <div className="rounded-xl border border-slate-200 dark:border-slate-600 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 dark:bg-slate-700">
                    <TableHead className="font-medium text-slate-700 dark:text-slate-300">Stichtag</TableHead>
                    <TableHead className="font-medium text-slate-700 dark:text-slate-300">Typ</TableHead>
                    <TableHead className="font-medium text-slate-700 dark:text-slate-300">Status</TableHead>
                    <TableHead className="font-medium text-slate-700 dark:text-slate-300 text-right">Aktion</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map((inv) => (
                    <TableRow
                      key={inv._id}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-700 ${selectedId === inv._id ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                    >
                      <TableCell className="dark:text-white">{formatDatum(inv.stichtag)}</TableCell>
                      <TableCell className="dark:text-slate-300">{inv.typ}</TableCell>
                      <TableCell>
                        <Badge variant={inv.status === 'abgeschlossen' ? 'secondary' : 'default'}>
                          {inv.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {inv.status === 'abgeschlossen' ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1"
                            onClick={() => window.open(`/api/lager/inventory/${inv._id}/pdf`, '_blank', 'noopener,noreferrer')}
                          >
                            <FileDown className="h-3 w-3" />
                            Protokoll herunterladen
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedId(selectedId === inv._id ? null : inv._id)}
                          >
                            {selectedId === inv._id ? 'Schließen' : 'Zählung'}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500 dark:text-slate-400 text-sm">
              <ClipboardCheck className="h-10 w-10 mx-auto mb-2 opacity-50" />
              Keine Inventur vorhanden. Klicken Sie auf „Inventur anlegen“ für eine Vollinventur.
            </div>
          )}

          {detail && selectedId && detail.status !== 'abgeschlossen' && (
            <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-600">
              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Zählung (Ist-Mengen)</h3>
              <div className="rounded-xl border border-slate-200 dark:border-slate-600 overflow-x-auto max-h-[300px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 dark:bg-slate-700">
                      <TableHead className="font-medium text-slate-700 dark:text-slate-300">Artikel</TableHead>
                      <TableHead className="font-medium text-slate-700 dark:text-slate-300 text-right">Soll</TableHead>
                      <TableHead className="font-medium text-slate-700 dark:text-slate-300 text-right">Ist</TableHead>
                      <TableHead className="font-medium text-slate-700 dark:text-slate-300 text-right">Differenz</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(detail.positionen ?? []).map((p: { artikelId: any; sollMenge: number; istMenge: number; differenz: number }, idx: number) => {
                      const aid = (p.artikelId as any)?._id?.toString?.() ?? (p.artikelId as any)?.toString?.() ?? ''
                      const ist = istMengen[aid] ?? p.istMenge
                      const diff = ist - p.sollMenge
                      const bezeichnung = (p.artikelId as any)?.bezeichnung ?? (p.artikelId as any)?.artikelnummer ?? '–'
                      return (
                        <TableRow key={aid || idx}>
                          <TableCell className="dark:text-white">{bezeichnung}</TableCell>
                          <TableCell className="text-right dark:text-slate-300">{p.sollMenge}</TableCell>
                          <TableCell className="text-right">
                            <input
                              type="number"
                              min={0}
                              value={ist}
                              onChange={(e) => setIstMengen((prev) => ({ ...prev, [aid]: parseInt(e.target.value, 10) || 0 }))}
                              className="w-20 text-right rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1 text-sm"
                            />
                          </TableCell>
                          <TableCell className={`text-right font-medium ${diff !== 0 ? 'text-amber-600 dark:text-amber-400' : 'dark:text-slate-300'}`}>
                            {diff > 0 ? '+' : ''}{diff}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
              <div className="flex gap-2 mt-3">
                <Button variant="outline" size="sm" onClick={handleSavePositionen} disabled={saving}>
                  {saving ? 'Speichern…' : 'Zählung speichern'}
                </Button>
                <Button size="sm" className="gap-1 bg-green-600 hover:bg-green-700" onClick={handleComplete} disabled={completing}>
                  <CheckCircle className="h-4 w-4" />
                  {completing ? 'Wird abgeschlossen…' : 'Inventur abschließen'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Neue Vollinventur</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              Es wird eine Inventur mit Stichtag heute angelegt. Alle aktiven Artikel werden mit aktuellem Bestand als Soll übernommen.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Abbrechen</Button>
              <Button onClick={handleCreate} disabled={saving}>{saving ? 'Wird angelegt…' : 'Anlegen'}</Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
