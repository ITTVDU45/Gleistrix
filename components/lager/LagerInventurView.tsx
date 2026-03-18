'use client'

import React, { useCallback, useState, useEffect } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { ClipboardCheck, Plus, CheckCircle, FileDown, Camera, Save } from 'lucide-react'
import type { Article, ArticleUnit, Category } from '@/types/main'
import { LagerApi } from '@/lib/api/lager'
import QrScannerSheet from '@/components/lager/mobile/QrScannerSheet'

interface InventoryArticleRef {
  _id?: string
  bezeichnung?: string
  artikelnummer?: string
  barcode?: string
  serialTracking?: 'none' | 'individual'
}

interface InventoryUnitRef {
  _id?: string
  seriennummer?: string
  barcode?: string
  status?: string
}

interface InventoryPosition {
  artikelId: InventoryArticleRef | string
  sollMenge: number
  istMenge: number
  differenz: number
  unitIds?: (InventoryUnitRef | string)[]
}

interface InventoryItem {
  _id: string
  name?: string
  typ: string
  stichtag: string
  zeitraumVon?: string | null
  zeitraumBis?: string | null
  status: string
  positionen?: InventoryPosition[]
}

interface LagerInventurViewProps {
  articles: Article[]
  categories?: Category[]
  onRefresh: () => void
}

type CreateFocusType = 'alle' | 'kategorien' | 'artikel'

interface InventoryFormState {
  name: string
  stichtag: string
  zeitraumVon: string
  zeitraumBis: string
}

interface CreateFormState extends InventoryFormState {
  fokusTyp: CreateFocusType
  kategorien: string[]
  artikelIds: string[]
  unitIds: string[]
}

function toggleSelection(arr: string[], value: string, add: boolean): string[] {
  return add ? [...arr, value] : arr.filter((v) => v !== value)
}

function getArticleId(a: Article): string {
  return (a as { _id?: string })._id?.toString?.() ?? a.id ?? ''
}

function getCategoryId(c: Category): string {
  return (c as { _id?: string })._id ?? (c as { id?: string }).id ?? ''
}

const todayISO = () => new Date().toISOString().slice(0, 10)

export default function LagerInventurView({ articles, categories, onRefresh }: LagerInventurViewProps) {
  const [list, setList] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<InventoryItem | null>(null)
  const [istMengen, setIstMengen] = useState<Record<string, number>>({})
  const [saving, setSaving] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [scanInput, setScanInput] = useState('')
  const [scanMessage, setScanMessage] = useState<string | null>(null)

  const activeArticles = (articles ?? []).filter((a) => (a.status ?? 'aktiv') === 'aktiv')
  const activeCategories = (categories ?? []).filter((c) => getCategoryId(c))

  const emptyCreateForm = (): CreateFormState => ({
    name: '', stichtag: todayISO(), zeitraumVon: '', zeitraumBis: '',
    fokusTyp: 'alle', kategorien: [], artikelIds: [], unitIds: []
  })
  const [createForm, setCreateForm] = useState<CreateFormState>(emptyCreateForm)

  const [createUnitsMap, setCreateUnitsMap] = useState<Record<string, ArticleUnit[]>>({})
  const [createUnitsLoading, setCreateUnitsLoading] = useState<Record<string, boolean>>({})

  const loadUnitsForCreate = useCallback(async (artId: string) => {
    if (createUnitsMap[artId] || createUnitsLoading[artId]) return
    setCreateUnitsLoading((prev) => ({ ...prev, [artId]: true }))
    try {
      const res = await LagerApi.units.list(artId)
      setCreateUnitsMap((prev) => ({ ...prev, [artId]: res.units ?? [] }))
    } catch {
      setCreateUnitsMap((prev) => ({ ...prev, [artId]: [] }))
    } finally {
      setCreateUnitsLoading((prev) => ({ ...prev, [artId]: false }))
    }
  }, [createUnitsMap, createUnitsLoading])
  const [metaForm, setMetaForm] = useState<InventoryFormState>({
    name: '',
    stichtag: '',
    zeitraumVon: '',
    zeitraumBis: ''
  })

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
      setMetaForm({ name: '', stichtag: '', zeitraumVon: '', zeitraumBis: '' })
      setScanInput('')
      setScanMessage(null)
      return
    }

    let cancelled = false
    LagerApi.inventory.get(selectedId).then((res) => {
      if (!cancelled && (res as any)?.success && (res as any).data) {
        const d = (res as any).data as InventoryItem
        setDetail(d)
        setMetaForm({
          name: d.name ?? '',
          stichtag: toDateInput(d.stichtag),
          zeitraumVon: toDateInput(d.zeitraumVon),
          zeitraumBis: toDateInput(d.zeitraumBis)
        })
        const next: Record<string, number> = {}
        ;(d.positionen ?? []).forEach((p) => {
          const id = resolveArticleId(p.artikelId)
          if (id) next[id] = p.istMenge
        })
        setIstMengen(next)
      }
    })

    return () => { cancelled = true }
  }, [selectedId])

  const handleCreate = async () => {
    if (createForm.zeitraumVon && createForm.zeitraumBis && createForm.zeitraumBis < createForm.zeitraumVon) {
      setScanMessage('Zeitraum-Ende darf nicht vor Zeitraum-Beginn liegen.')
      return
    }
    if (!createForm.name.trim()) {
      setScanMessage('Bitte Inventurname angeben.')
      return
    }
    if (createForm.fokusTyp === 'kategorien' && createForm.kategorien.length === 0) {
      setScanMessage('Bitte mindestens eine Kategorie auswaehlen.')
      return
    }
    if (createForm.fokusTyp === 'artikel' && createForm.artikelIds.length === 0) {
      setScanMessage('Bitte mindestens ein Produkt auswaehlen.')
      return
    }

    setSaving(true)
    try {
      const res = await LagerApi.inventory.create({
        name: createForm.name.trim(),
        typ: createForm.fokusTyp === 'alle' ? 'voll' : 'teil',
        stichtag: createForm.stichtag || todayISO(),
        zeitraumVon: createForm.zeitraumVon || undefined,
        zeitraumBis: createForm.zeitraumBis || undefined,
        kategorien: createForm.fokusTyp === 'kategorien' ? createForm.kategorien : undefined,
        artikelIds: createForm.fokusTyp === 'artikel' ? createForm.artikelIds : undefined,
        unitIds: createForm.unitIds.length > 0 ? createForm.unitIds : undefined
      })
      if ((res as any)?.success && (res as any).data) {
        setCreateOpen(false)
        setCreateForm(emptyCreateForm())
        setCreateUnitsMap({})
        setScanMessage(null)
        await loadList()
        setSelectedId((res as any).data._id)
      }
    } finally {
      setSaving(false)
    }
  }

  const handleSaveMeta = async () => {
    if (!selectedId) return
    if (metaForm.zeitraumVon && metaForm.zeitraumBis && metaForm.zeitraumBis < metaForm.zeitraumVon) {
      setScanMessage('Zeitraum-Ende darf nicht vor Zeitraum-Beginn liegen.')
      return
    }

    setSaving(true)
    try {
      await LagerApi.inventory.update(selectedId, {
        name: metaForm.name.trim(),
        stichtag: metaForm.stichtag,
        zeitraumVon: metaForm.zeitraumVon || null,
        zeitraumBis: metaForm.zeitraumBis || null
      })
      const res = await LagerApi.inventory.get(selectedId)
      if ((res as any)?.success && (res as any).data) {
        setDetail((res as any).data as InventoryItem)
      }
      await loadList()
      onRefresh()
      setScanMessage('Inventurdaten gespeichert.')
    } finally {
      setSaving(false)
    }
  }

  const handleSavePositionen = async () => {
    if (!selectedId || !detail) return
    const positionen = (detail.positionen ?? []).map((p) => {
      const id = resolveArticleId(p.artikelId)
      return { artikelId: id, istMenge: istMengen[id] ?? 0 }
    }).filter((p) => p.artikelId)

    setSaving(true)
    try {
      await LagerApi.inventory.update(selectedId, { positionen })
      const res = await LagerApi.inventory.get(selectedId)
      if ((res as any)?.success && (res as any).data) setDetail((res as any).data)
      onRefresh()
      setScanMessage('Zaehlung gespeichert.')
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
      await loadList()
      onRefresh()
    } finally {
      setCompleting(false)
    }
  }

  const applyScanToInventory = (rawCode: string) => {
    if (!detail?.positionen?.length) {
      setScanMessage('Keine offene Inventur ausgewaehlt.')
      return
    }

    const normalized = rawCode.trim().toLowerCase()
    if (!normalized) return

    const matched = detail.positionen.find((p) => {
      const article = toArticleObject(p.artikelId)
      if (!article) return false
      const barcode = article.barcode?.trim().toLowerCase() ?? ''
      const artikelnummer = article.artikelnummer?.trim().toLowerCase() ?? ''
      return (barcode.length > 0 && (barcode === normalized || normalized.endsWith(barcode))) || (artikelnummer.length > 0 && (artikelnummer === normalized || normalized.endsWith(artikelnummer)))
    })

    if (!matched) {
      setScanMessage(`Kein Artikel zur Inventur passend gefunden: ${rawCode}`)
      return
    }

    const article = toArticleObject(matched.artikelId)
    const articleId = resolveArticleId(matched.artikelId)
    if (!articleId) return

    setIstMengen((prev) => ({
      ...prev,
      [articleId]: (prev[articleId] ?? matched.istMenge ?? 0) + 1
    }))

    setScanMessage(`Scan erfasst: ${article?.bezeichnung ?? article?.artikelnummer ?? articleId}`)
    setScanInput('')
  }

  const formatDatum = (d?: string | null) => {
    if (!d) return '-'
    const parsed = new Date(d)
    if (Number.isNaN(parsed.getTime())) return '-'
    return parsed.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  const formatZeitraum = (item: InventoryItem) => {
    if (!item.zeitraumVon && !item.zeitraumBis) return '-'
    if (item.zeitraumVon && item.zeitraumBis) return `${formatDatum(item.zeitraumVon)} - ${formatDatum(item.zeitraumBis)}`
    return `${formatDatum(item.zeitraumVon ?? item.zeitraumBis)} (einseitig)`
  }

  return (
    <>
      <Card className="border-0 shadow-lg bg-white dark:bg-slate-800 rounded-xl">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Inventur</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                Inventuren starten, benennen, im Zeitraum planen und per QR-Code zaehlen
              </p>
            </div>
            <Button
              variant="default"
              className="gap-2 bg-blue-600 hover:bg-blue-700"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="h-4 w-4" />
              Inventur starten
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
                    <TableHead className="font-medium text-slate-700 dark:text-slate-300">Name</TableHead>
                    <TableHead className="font-medium text-slate-700 dark:text-slate-300">Zeitraum</TableHead>
                    <TableHead className="font-medium text-slate-700 dark:text-slate-300">Stichtag</TableHead>
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
                      <TableCell className="dark:text-white">{inv.name || 'Ohne Namen'}</TableCell>
                      <TableCell className="dark:text-slate-300">{formatZeitraum(inv)}</TableCell>
                      <TableCell className="dark:text-slate-300">{formatDatum(inv.stichtag)}</TableCell>
                      <TableCell>
                        <Badge variant={inv.status === 'abgeschlossen' ? 'secondary' : 'default'}>
                          {inv.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        {inv.status === 'abgeschlossen' && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1"
                            onClick={() => window.open(`/api/lager/inventory/${inv._id}/pdf`, '_blank', 'noopener,noreferrer')}
                          >
                            <FileDown className="h-3 w-3" />
                            Protokoll
                          </Button>
                        )}
                        <Button
                          variant={selectedId === inv._id ? 'secondary' : 'ghost'}
                          size="sm"
                          onClick={() => setSelectedId(selectedId === inv._id ? null : inv._id)}
                        >
                          {selectedId === inv._id ? 'Schliessen' : inv.status === 'abgeschlossen' ? 'Einsehen' : 'Bearbeiten'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500 dark:text-slate-400 text-sm">
              <ClipboardCheck className="h-10 w-10 mx-auto mb-2 opacity-50" />
              Keine Inventur vorhanden. Klicken Sie auf "Inventur starten".
            </div>
          )}

          {detail && selectedId && (
            <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-600 space-y-4">
              <div>
                <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Inventurdaten</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  <label className="text-xs text-slate-600 dark:text-slate-400">
                    Name
                    <input
                      type="text"
                      value={metaForm.name}
                      onChange={(e) => setMetaForm((prev) => ({ ...prev, name: e.target.value }))}
                      disabled={detail.status === 'abgeschlossen'}
                      className="mt-1 w-full rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1.5 text-sm"
                    />
                  </label>
                  <label className="text-xs text-slate-600 dark:text-slate-400">
                    Stichtag
                    <input
                      type="date"
                      value={metaForm.stichtag}
                      onChange={(e) => setMetaForm((prev) => ({ ...prev, stichtag: e.target.value }))}
                      disabled={detail.status === 'abgeschlossen'}
                      className="mt-1 w-full rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1.5 text-sm"
                    />
                  </label>
                  <label className="text-xs text-slate-600 dark:text-slate-400">
                    Zeitraum von
                    <input
                      type="date"
                      value={metaForm.zeitraumVon}
                      onChange={(e) => setMetaForm((prev) => ({ ...prev, zeitraumVon: e.target.value }))}
                      disabled={detail.status === 'abgeschlossen'}
                      className="mt-1 w-full rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1.5 text-sm"
                    />
                  </label>
                  <label className="text-xs text-slate-600 dark:text-slate-400">
                    Zeitraum bis
                    <input
                      type="date"
                      value={metaForm.zeitraumBis}
                      onChange={(e) => setMetaForm((prev) => ({ ...prev, zeitraumBis: e.target.value }))}
                      disabled={detail.status === 'abgeschlossen'}
                      className="mt-1 w-full rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1.5 text-sm"
                    />
                  </label>
                </div>
                {detail.status !== 'abgeschlossen' && (
                  <div className="mt-2">
                    <Button variant="outline" size="sm" onClick={handleSaveMeta} disabled={saving}>
                      <Save className="h-4 w-4 mr-1" />
                      {saving ? 'Speichert...' : 'Inventurdaten speichern'}
                    </Button>
                  </div>
                )}
              </div>

              {detail.status !== 'abgeschlossen' && (
                <div>
                  <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">QR-Scan fuer Zaehlung</h3>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => setScannerOpen(true)} className="gap-1">
                      <Camera className="h-4 w-4" />
                      QR-Code scannen
                    </Button>
                    <input
                      type="text"
                      value={scanInput}
                      onChange={(e) => setScanInput(e.target.value)}
                      placeholder="Code manuell eingeben"
                      className="min-w-[220px] rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1.5 text-sm"
                    />
                    <Button size="sm" variant="outline" onClick={() => applyScanToInventory(scanInput)}>
                      Code uebernehmen
                    </Button>
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Zaehlung (Ist-Mengen)</h3>
                <div className="rounded-xl border border-slate-200 dark:border-slate-600 overflow-x-auto max-h-[320px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50 dark:bg-slate-700">
                        <TableHead className="font-medium text-slate-700 dark:text-slate-300">Artikel</TableHead>
                        <TableHead className="font-medium text-slate-700 dark:text-slate-300">Barcode</TableHead>
                        <TableHead className="font-medium text-slate-700 dark:text-slate-300">Seriennummern</TableHead>
                        <TableHead className="font-medium text-slate-700 dark:text-slate-300 text-right">Soll</TableHead>
                        <TableHead className="font-medium text-slate-700 dark:text-slate-300 text-right">Ist</TableHead>
                        <TableHead className="font-medium text-slate-700 dark:text-slate-300 text-right">Differenz</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(detail.positionen ?? []).map((p, idx) => {
                        const article = toArticleObject(p.artikelId)
                        const aid = resolveArticleId(p.artikelId)
                        const ist = istMengen[aid] ?? p.istMenge
                        const diff = ist - p.sollMenge
                        const bezeichnung = article?.bezeichnung ?? article?.artikelnummer ?? '-'
                        const resolvedUnits = (p.unitIds ?? [])
                          .map((u) => (typeof u === 'object' && u !== null ? u as InventoryUnitRef : null))
                          .filter(Boolean) as InventoryUnitRef[]
                        return (
                          <TableRow key={aid || idx}>
                            <TableCell className="dark:text-white">{bezeichnung}</TableCell>
                            <TableCell className="dark:text-slate-300">{article?.barcode || '-'}</TableCell>
                            <TableCell>
                              {resolvedUnits.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {resolvedUnits.map((u) => (
                                    <Badge key={u._id} variant="outline" className="text-[10px] font-mono px-1 py-0">
                                      {u.seriennummer}
                                    </Badge>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-xs text-slate-400">–</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right dark:text-slate-300">{p.sollMenge}</TableCell>
                            <TableCell className="text-right">
                              <input
                                type="number"
                                min={0}
                                value={ist}
                                disabled={detail.status === 'abgeschlossen'}
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
              </div>

              {scanMessage && (
                <div className="rounded-lg bg-slate-100 dark:bg-slate-700 px-3 py-2 text-sm text-slate-700 dark:text-slate-200">
                  {scanMessage}
                </div>
              )}

              {detail.status !== 'abgeschlossen' && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleSavePositionen} disabled={saving}>
                    {saving ? 'Speichert...' : 'Zaehlung speichern'}
                  </Button>
                  <Button size="sm" className="gap-1 bg-green-600 hover:bg-green-700" onClick={handleComplete} disabled={completing}>
                    <CheckCircle className="h-4 w-4" />
                    {completing ? 'Wird abgeschlossen...' : 'Inventur abschliessen'}
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <QrScannerSheet
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onScanSuccess={(code) => applyScanToInventory(code)}
      />

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6 max-w-lg w-full mx-4 max-h-[85vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Neue Inventur</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              Definieren Sie Name, Stichtag, Fokus und optional einen Zeitraum.
            </p>
            <div className="space-y-3 mb-4">
              <label className="block text-xs text-slate-600 dark:text-slate-400">
                Inventurname *
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="z. B. Q2 Hauptlager"
                  className="mt-1 w-full rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1.5 text-sm"
                />
              </label>
              <label className="block text-xs text-slate-600 dark:text-slate-400">
                Stichtag
                <input
                  type="date"
                  value={createForm.stichtag}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, stichtag: e.target.value }))}
                  className="mt-1 w-full rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1.5 text-sm"
                />
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block text-xs text-slate-600 dark:text-slate-400">
                  Zeitraum von
                  <input
                    type="date"
                    value={createForm.zeitraumVon}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, zeitraumVon: e.target.value }))}
                    className="mt-1 w-full rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="block text-xs text-slate-600 dark:text-slate-400">
                  Zeitraum bis
                  <input
                    type="date"
                    value={createForm.zeitraumBis}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, zeitraumBis: e.target.value }))}
                    className="mt-1 w-full rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1.5 text-sm"
                  />
                </label>
              </div>

              <div>
                <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">Inventur-Fokus</p>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant={createForm.fokusTyp === 'alle' ? 'default' : 'outline'}
                    onClick={() => setCreateForm((p) => ({ ...p, fokusTyp: 'alle', kategorien: [], artikelIds: [], unitIds: [] }))}>
                    Alle Produkte
                  </Button>
                  <Button type="button" size="sm" variant={createForm.fokusTyp === 'kategorien' ? 'default' : 'outline'}
                    onClick={() => setCreateForm((p) => ({ ...p, fokusTyp: 'kategorien', artikelIds: [], unitIds: [] }))}>
                    Kategorien
                  </Button>
                  <Button type="button" size="sm" variant={createForm.fokusTyp === 'artikel' ? 'default' : 'outline'}
                    onClick={() => setCreateForm((p) => ({ ...p, fokusTyp: 'artikel', kategorien: [], unitIds: [] }))}>
                    Einzelprodukte
                  </Button>
                </div>
              </div>

              {createForm.fokusTyp === 'kategorien' && (
                <div>
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Kategorien</p>
                  <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2 dark:border-slate-700">
                    {activeCategories.length === 0 ? (
                      <p className="text-xs text-slate-400">Keine Kategorien vorhanden.</p>
                    ) : activeCategories.map((c) => {
                      const cName = c.name?.trim() ?? ''
                      if (!cName) return null
                      return (
                        <label key={getCategoryId(c)} className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700">
                          <Checkbox checked={createForm.kategorien.includes(cName)}
                            onCheckedChange={(ch) => setCreateForm((p) => ({ ...p, kategorien: toggleSelection(p.kategorien, cName, ch === true) }))} />
                          <span>{cName}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              )}

              {createForm.fokusTyp === 'artikel' && (
                <div>
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Produkte</p>
                  <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2 dark:border-slate-700">
                    {activeArticles.length === 0 ? (
                      <p className="text-xs text-slate-400">Keine Produkte vorhanden.</p>
                    ) : activeArticles
                      .slice()
                      .sort((a, b) => (a.bezeichnung || '').localeCompare(b.bezeichnung || '', 'de'))
                      .map((article) => {
                        const artId = getArticleId(article)
                        if (!artId) return null
                        const isChecked = createForm.artikelIds.includes(artId)
                        const hasIndividual = article.serialTracking === 'individual'
                        const artUnits = createUnitsMap[artId] ?? []
                        const isUnitLoading = createUnitsLoading[artId] ?? false

                        return (
                          <div key={artId}>
                            <label className="flex cursor-pointer items-start gap-2 rounded px-1 py-0.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700">
                              <Checkbox checked={isChecked}
                                onCheckedChange={(ch) => {
                                  const add = ch === true
                                  setCreateForm((p) => ({
                                    ...p,
                                    artikelIds: toggleSelection(p.artikelIds, artId, add),
                                    unitIds: add ? p.unitIds : p.unitIds.filter((uid) => !artUnits.some((u) => (u.id ?? u._id) === uid))
                                  }))
                                  if (add && hasIndividual) loadUnitsForCreate(artId)
                                }} />
                              <span className="leading-tight">
                                <span className="font-medium text-slate-900 dark:text-white">{article.bezeichnung}</span>
                                <span className="block text-xs text-slate-500">{article.artikelnummer}</span>
                              </span>
                            </label>
                            {isChecked && hasIndividual && (
                              <div className="ml-7 mt-1 mb-2 space-y-1 rounded border border-slate-100 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-800/50">
                                <p className="text-[11px] font-medium text-slate-500">Geräte / Seriennummern:</p>
                                {isUnitLoading ? (
                                  <p className="text-xs text-slate-400">Lade...</p>
                                ) : artUnits.length === 0 ? (
                                  <p className="text-xs text-slate-400">Keine Seriennummern</p>
                                ) : artUnits.map((unit) => {
                                  const uid = unit.id ?? unit._id ?? ''
                                  return (
                                    <label key={uid} className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-xs hover:bg-slate-100 dark:hover:bg-slate-700/50">
                                      <Checkbox checked={createForm.unitIds.includes(uid)}
                                        onCheckedChange={(ch) => setCreateForm((p) => ({ ...p, unitIds: toggleSelection(p.unitIds, uid, ch === true) }))} />
                                      <span className="font-mono">{unit.seriennummer}</span>
                                      <Badge variant="outline" className="text-[9px] px-1 py-0">
                                        {unit.status === 'verfuegbar' ? 'Verfügbar' : unit.status === 'ausgegeben' ? 'Ausgegeben' : unit.status === 'in_wartung' ? 'In Wartung' : unit.status === 'defekt' ? 'Defekt' : unit.status}
                                      </Badge>
                                    </label>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        )
                      })}
                  </div>
                </div>
              )}
            </div>
            {scanMessage && (
              <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-sm text-amber-700 dark:text-amber-300 mb-3">
                {scanMessage}
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { setCreateOpen(false); setCreateForm(emptyCreateForm()); setScanMessage(null) }}>Abbrechen</Button>
              <Button onClick={handleCreate} disabled={saving}>{saving ? 'Wird angelegt...' : 'Starten'}</Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function resolveArticleId(artikelId: InventoryArticleRef | string): string {
  if (typeof artikelId === 'string') return artikelId
  return artikelId?._id?.toString?.() ?? ''
}

function toArticleObject(artikelId: InventoryArticleRef | string): InventoryArticleRef | null {
  if (!artikelId || typeof artikelId === 'string') return null
  return artikelId
}

function toDateInput(value?: string | null): string {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toISOString().slice(0, 10)
}

