'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { FileDown, RefreshCw, Eye, ArrowRight } from 'lucide-react'
import { LagerApi } from '@/lib/api/lager'
import type { StockMovement } from '@/types/main'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

type DeliveryNoteType = 'eingang' | 'ausgang'
type DeliveryNoteStatus = 'entwurf' | 'abgeschlossen'

type DeliveryAttachment = {
  attachmentId: string
  filename: string
}

type DeliveryPosition = {
  artikelId?: { _id?: string; bezeichnung?: string; artikelnummer?: string } | string
  bezeichnung?: string
  menge?: number
}

interface DeliveryNoteRow {
  _id: string
  nummer: string
  datum?: string
  typ: DeliveryNoteType
  status?: DeliveryNoteStatus
  empfaenger?: { name?: string; adresse?: string }
  attachments?: DeliveryAttachment[]
  positionen?: DeliveryPosition[]
}

interface LagerLieferscheineViewProps {
  onRefresh: () => void
  onOpenMovements?: (lieferscheinId: string) => void
}

export default function LagerLieferscheineView({ onRefresh, onOpenMovements }: LagerLieferscheineViewProps) {
  const [list, setList] = useState<DeliveryNoteRow[]>([])
  const [loading, setLoading] = useState(true)

  const [typeFilter, setTypeFilter] = useState<'alle' | DeliveryNoteType>('alle')
  const [statusFilter, setStatusFilter] = useState<'alle' | DeliveryNoteStatus>('alle')
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedNote, setSelectedNote] = useState<DeliveryNoteRow | null>(null)
  const [detailMovements, setDetailMovements] = useState<StockMovement[]>([])
  const [detailLoading, setDetailLoading] = useState(false)

  const loadList = async () => {
    setLoading(true)
    try {
      const res = await LagerApi.deliveryNotes.list({
        typ: typeFilter === 'alle' ? undefined : typeFilter,
        status: statusFilter === 'alle' ? undefined : statusFilter,
        search: search.trim() || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        limit: 300
      })
      if (res?.success && (res as { deliveryNotes?: DeliveryNoteRow[] }).deliveryNotes) {
        setList((res as { deliveryNotes: DeliveryNoteRow[] }).deliveryNotes)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadList()
  }, [onRefresh, typeFilter, statusFilter, dateFrom, dateTo])

  const filteredList = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('de-DE')
    if (!needle) return list
    return list.filter((item) => {
      const nummer = String(item.nummer ?? '').toLocaleLowerCase('de-DE')
      const empfaenger = String(item.empfaenger?.name ?? '').toLocaleLowerCase('de-DE')
      return nummer.includes(needle) || empfaenger.includes(needle)
    })
  }, [list, search])

  const formatDatum = (d: string | undefined) => {
    if (!d) return '-'
    return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  const downloadPdf = (id: string) => {
    const url = `/api/lager/delivery-notes/${id}/pdf`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const openDetails = async (row: DeliveryNoteRow) => {
    setDetailOpen(true)
    setSelectedNote(row)
    setDetailLoading(true)
    try {
      const [noteRes, movementRes] = await Promise.all([
        LagerApi.deliveryNotes.get(row._id),
        LagerApi.movements.list({ lieferscheinId: row._id })
      ])
      const note = (noteRes as { data?: DeliveryNoteRow })?.data
      if (note) setSelectedNote(note)
      const movements = (movementRes as { movements?: StockMovement[] })?.movements ?? []
      setDetailMovements(movements)
    } finally {
      setDetailLoading(false)
    }
  }

  const moveToHistory = (noteId: string) => {
    setDetailOpen(false)
    if (onOpenMovements) {
      onOpenMovements(noteId)
      return
    }
  }

  return (
    <>
      <Card className="border-0 shadow-lg bg-white dark:bg-slate-800 rounded-xl">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Lieferscheine ansehen</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                Alle Lieferscheine aus Wareneingang und Warenausgang mit Detailansicht und Download
              </p>
            </div>
            <Button size="icon" variant="outline" onClick={loadList} disabled={loading} aria-label="Lieferscheine aktualisieren">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-5">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Suche: Nummer oder Empfaenger"
              className="h-9"
            />
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value as typeof typeFilter)}
              className="h-9 rounded-md border border-slate-200 px-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="alle">Typ: Alle</option>
              <option value="eingang">Eingang</option>
              <option value="ausgang">Ausgang</option>
            </select>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
              className="h-9 rounded-md border border-slate-200 px-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="alle">Status: Alle</option>
              <option value="entwurf">Entwurf</option>
              <option value="abgeschlossen">Abgeschlossen</option>
            </select>
            <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="h-9" />
            <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="h-9" />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-slate-500 py-4">Lade Lieferscheine...</p>
          ) : filteredList.length === 0 ? (
            <p className="text-sm text-slate-500 py-4">Keine Lieferscheine vorhanden.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nummer</TableHead>
                  <TableHead>Datum</TableHead>
                  <TableHead>Typ</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Empfaenger</TableHead>
                  <TableHead className="w-[140px]">Toolbar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredList.map((row) => (
                  <TableRow key={row._id}>
                    <TableCell className="font-medium">{row.nummer}</TableCell>
                    <TableCell>{formatDatum(row.datum)}</TableCell>
                    <TableCell>
                      <Badge variant={row.typ === 'ausgang' ? 'default' : 'secondary'}>
                        {row.typ === 'ausgang' ? 'Ausgang' : 'Eingang'}
                      </Badge>
                    </TableCell>
                    <TableCell>{row.status ?? '-'}</TableCell>
                    <TableCell>{row.empfaenger?.name ?? '-'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="outline" size="icon" title="Details" onClick={() => openDetails(row)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="icon" title="PDF herunterladen" onClick={() => downloadPdf(row._id)}>
                          <FileDown className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Lieferschein-Details</DialogTitle>
          </DialogHeader>
          {!selectedNote || detailLoading ? (
            <p className="text-sm text-slate-500">Lade Details...</p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <p><strong>Nummer:</strong> {selectedNote.nummer}</p>
                <p><strong>Datum:</strong> {formatDatum(selectedNote.datum)}</p>
                <p><strong>Typ:</strong> {selectedNote.typ}</p>
                <p><strong>Status:</strong> {selectedNote.status ?? '-'}</p>
                <p><strong>Empfaenger:</strong> {selectedNote.empfaenger?.name ?? '-'}</p>
                <p><strong>Adresse:</strong> {selectedNote.empfaenger?.adresse ?? '-'}</p>
              </div>

              <div>
                <p className="mb-2 text-sm font-semibold">Positionen</p>
                <div className="space-y-1 text-sm">
                  {(selectedNote.positionen ?? []).map((pos, idx) => {
                    const artikel = typeof pos.artikelId === 'object' ? pos.artikelId : null
                    return (
                      <p key={`${selectedNote._id}-${idx}`}>
                        {(pos.bezeichnung ?? artikel?.bezeichnung ?? artikel?.artikelnummer ?? 'Artikel')} - Menge {pos.menge ?? 0}
                      </p>
                    )
                  })}
                  {(selectedNote.positionen ?? []).length === 0 && <p className="text-slate-500">Keine Positionen</p>}
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-semibold">Anhaenge/Dateien</p>
                <div className="space-y-1 text-sm">
                  {(selectedNote.attachments ?? []).map((att) => (
                    <p key={att.attachmentId}>{att.filename}</p>
                  ))}
                  {(selectedNote.attachments ?? []).length === 0 && <p className="text-slate-500">Keine Dateien</p>}
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-semibold">Verknuepfte Bewegung(en)</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">{detailMovements.length} Bewegung(en) gefunden</p>
                <Button variant="outline" size="sm" className="mt-2" onClick={() => moveToHistory(selectedNote._id)}>
                  <ArrowRight className="mr-1 h-4 w-4" />
                  In Bewegungshistorie oeffnen
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => downloadPdf(selectedNote._id)}>
                  <FileDown className="mr-1 h-4 w-4" />PDF herunterladen
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
