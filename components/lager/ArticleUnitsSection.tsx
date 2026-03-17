'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Plus, Trash2, Pencil, Upload, QrCode, Download, Printer } from 'lucide-react'
import type { ArticleUnit, ArticleUnitStatus, ArticleZustand } from '@/types/main'
import { LagerApi } from '@/lib/api/lager'
import { QRCodeCanvas } from 'qrcode.react'
import QRCode from 'qrcode'

interface ArticleUnitsSectionProps {
  articleId: string
  articleBezeichnung?: string
  onStockChanged?: () => void
}

const STATUS_LABELS: Record<ArticleUnitStatus, string> = {
  verfuegbar: 'Verfügbar',
  ausgegeben: 'Ausgegeben',
  in_wartung: 'In Wartung',
  defekt: 'Defekt',
  archiviert: 'Archiviert'
}

const STATUS_COLORS: Record<ArticleUnitStatus, string> = {
  verfuegbar: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  ausgegeben: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  in_wartung: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  defekt: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  archiviert: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
}

const ZUSTAND_OPTIONS: ArticleZustand[] = ['neu', 'gut', 'gebraucht', 'defekt']
const STATUS_OPTIONS: ArticleUnitStatus[] = ['verfuegbar', 'ausgegeben', 'in_wartung', 'defekt', 'archiviert']

export default function ArticleUnitsSection({ articleId, articleBezeichnung, onStockChanged }: ArticleUnitsSectionProps) {
  const [units, setUnits] = useState<ArticleUnit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [addOpen, setAddOpen] = useState(false)
  const [addSerial, setAddSerial] = useState('')
  const [addZustand, setAddZustand] = useState<ArticleZustand>('neu')
  const [addLagerort, setAddLagerort] = useState('')
  const [addSubmitting, setAddSubmitting] = useState(false)

  const [editUnit, setEditUnit] = useState<ArticleUnit | null>(null)
  const [editForm, setEditForm] = useState({ seriennummer: '', zustand: 'neu' as ArticleZustand, lagerort: '', notizen: '', status: 'verfuegbar' as ArticleUnitStatus })

  const [qrUnit, setQrUnit] = useState<ArticleUnit | null>(null)

  const [csvImporting, setCsvImporting] = useState(false)

  const loadUnits = useCallback(async () => {
    try {
      setLoading(true)
      const res = await LagerApi.units.list(articleId)
      setUnits(res.units ?? [])
    } catch {
      setError('Fehler beim Laden der Units')
    } finally {
      setLoading(false)
    }
  }, [articleId])

  useEffect(() => { loadUnits() }, [loadUnits])

  const handleAdd = async () => {
    if (!addSerial.trim()) return
    setAddSubmitting(true)
    try {
      await LagerApi.units.create(articleId, {
        seriennummer: addSerial.trim(),
        zustand: addZustand,
        lagerort: addLagerort
      })
      setAddSerial('')
      setAddZustand('neu')
      setAddLagerort('')
      setAddOpen(false)
      await loadUnits()
      onStockChanged?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Anlegen')
    } finally {
      setAddSubmitting(false)
    }
  }

  const handleDelete = async (unit: ArticleUnit) => {
    const id = unit.id ?? unit._id
    if (!id || !confirm(`Unit "${unit.seriennummer}" wirklich löschen?`)) return
    try {
      await LagerApi.units.delete(articleId, id)
      await loadUnits()
      onStockChanged?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Löschen')
    }
  }

  const openEdit = (unit: ArticleUnit) => {
    setEditUnit(unit)
    setEditForm({
      seriennummer: unit.seriennummer,
      zustand: unit.zustand ?? 'neu',
      lagerort: unit.lagerort ?? '',
      notizen: unit.notizen ?? '',
      status: unit.status ?? 'verfuegbar'
    })
  }

  const handleEditSave = async () => {
    const id = editUnit?.id ?? editUnit?._id
    if (!id) return
    try {
      await LagerApi.units.update(articleId, id, editForm)
      setEditUnit(null)
      await loadUnits()
      onStockChanged?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Speichern')
    }
  }

  const handleCsvImport = (file: File) => {
    setCsvImporting(true)
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const text = ev.target?.result as string
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
      const serials = lines.flatMap(l => l.split(/[;,\t]/).map(s => s.trim()).filter(Boolean))
      if (serials.length === 0) { setCsvImporting(false); return }
      try {
        await LagerApi.units.bulkCreate(articleId, serials.map(s => ({ seriennummer: s })))
        await loadUnits()
        onStockChanged?.()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Fehler beim Import')
      } finally {
        setCsvImporting(false)
      }
    }
    reader.readAsText(file)
  }

  const handleUnitQrDownload = async (unit: ArticleUnit) => {
    const code = unit.barcode ?? unit.seriennummer
    if (!code) return
    const qrSize = 1024
    const dataUrl = await QRCode.toDataURL(code, { width: qrSize, margin: 2, errorCorrectionLevel: 'M' })
    const canvas = document.createElement('canvas')
    const padding = 24
    const textHeight = 56
    canvas.width = qrSize + padding * 2
    canvas.height = qrSize + padding * 2 + textHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => { ctx.drawImage(img, padding, padding, qrSize, qrSize); resolve() }
      img.onerror = () => reject()
      img.src = dataUrl
    })
    ctx.fillStyle = '#111827'
    ctx.font = 'bold 28px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(`SN: ${unit.seriennummer}`, canvas.width / 2, qrSize + padding + 40)
    const link = document.createElement('a')
    link.href = canvas.toDataURL('image/png')
    link.download = `unit-${unit.seriennummer}-qr.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleUnitQrPrint = async (unit: ArticleUnit) => {
    const code = unit.barcode ?? unit.seriennummer
    if (!code) return
    const dataUrl = await QRCode.toDataURL(code, { width: 400, margin: 2, errorCorrectionLevel: 'M' })
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`<!DOCTYPE html><html><head><title>QR - ${unit.seriennummer}</title>
      <style>body{font-family:system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px;}
      .qr img{display:block;}.sn{font-size:18px;font-weight:600;margin:12px 0 4px;}.meta{font-size:12px;color:#666;}@media print{body{padding:16px;}}</style></head>
      <body><div class="qr"><img src="${dataUrl.replace(/"/g, '&quot;')}" width="200" height="200"/></div>
      <p class="sn">SN: ${unit.seriennummer}</p>
      <p class="meta">${(articleBezeichnung ?? '').replace(/</g, '&lt;')}</p></body></html>`)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print(); win.close() }, 300)
  }

  if (loading) return <p className="text-sm text-slate-500 p-4">Lade Seriennummern...</p>

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="outline" className="rounded-lg" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Unit hinzufügen
        </Button>
        <label className="cursor-pointer">
          <input
            type="file"
            accept=".csv,.txt"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) handleCsvImport(f)
              e.target.value = ''
            }}
          />
          <span className="inline-flex items-center gap-1 text-xs border rounded-lg px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
            <Upload className="h-3.5 w-3.5" />
            {csvImporting ? 'Importiere...' : 'CSV importieren'}
          </span>
        </label>
        <span className="text-xs text-slate-500 ml-auto">{units.length} Einheiten</span>
      </div>

      {units.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-6">Keine Seriennummern vorhanden</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-400">Nr.</th>
                <th className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-400">Seriennummer</th>
                <th className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-400">Barcode</th>
                <th className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-400">Status</th>
                <th className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-400">Zustand</th>
                <th className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-400">Lagerort</th>
                <th className="px-3 py-2 text-right font-medium text-slate-600 dark:text-slate-400">Aktionen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {units.map((unit, idx) => {
                const unitId = unit.id ?? unit._id ?? ''
                return (
                  <tr key={unitId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="px-3 py-2 text-slate-500">{idx + 1}</td>
                    <td className="px-3 py-2 font-mono text-xs">{unit.seriennummer}</td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-500">{unit.barcode ?? '-'}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[unit.status] ?? ''}`}>
                        {STATUS_LABELS[unit.status] ?? unit.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 capitalize">{unit.zustand ?? '-'}</td>
                    <td className="px-3 py-2">{unit.lagerort || '-'}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1">
                        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => setQrUnit(unit)} title="QR-Code">
                          <QrCode className="h-3.5 w-3.5" />
                        </Button>
                        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(unit)} title="Bearbeiten">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:text-red-700" onClick={() => handleDelete(unit)} title="Löschen">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Unit Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>Unit hinzufügen</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">Seriennummer *</label>
              <Input value={addSerial} onChange={e => setAddSerial(e.target.value)} placeholder="z.B. SN-00123" className="rounded-lg" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Zustand</label>
              <Select value={addZustand} onValueChange={v => setAddZustand(v as ArticleZustand)}>
                <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ZUSTAND_OPTIONS.map(z => <SelectItem key={z} value={z}>{z}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Lagerort</label>
              <Input value={addLagerort} onChange={e => setAddLagerort(e.target.value)} placeholder="optional" className="rounded-lg" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Abbrechen</Button>
              <Button type="button" onClick={handleAdd} disabled={addSubmitting || !addSerial.trim()}>
                {addSubmitting ? 'Wird angelegt...' : 'Anlegen'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Unit Dialog */}
      <Dialog open={!!editUnit} onOpenChange={v => { if (!v) setEditUnit(null) }}>
        <DialogContent className="sm:max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>Unit bearbeiten</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">Seriennummer</label>
              <Input value={editForm.seriennummer} onChange={e => setEditForm(p => ({ ...p, seriennummer: e.target.value }))} className="rounded-lg" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Status</label>
              <Select value={editForm.status} onValueChange={v => setEditForm(p => ({ ...p, status: v as ArticleUnitStatus }))}>
                <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Zustand</label>
              <Select value={editForm.zustand} onValueChange={v => setEditForm(p => ({ ...p, zustand: v as ArticleZustand }))}>
                <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ZUSTAND_OPTIONS.map(z => <SelectItem key={z} value={z}>{z}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Lagerort</label>
              <Input value={editForm.lagerort} onChange={e => setEditForm(p => ({ ...p, lagerort: e.target.value }))} className="rounded-lg" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Notizen</label>
              <Input value={editForm.notizen} onChange={e => setEditForm(p => ({ ...p, notizen: e.target.value }))} className="rounded-lg" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setEditUnit(null)}>Abbrechen</Button>
              <Button type="button" onClick={handleEditSave}>Speichern</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* QR Unit Dialog */}
      <Dialog open={!!qrUnit} onOpenChange={v => { if (!v) setQrUnit(null) }}>
        <DialogContent className="sm:max-w-xs rounded-2xl">
          <DialogHeader>
            <DialogTitle>QR-Code: {qrUnit?.seriennummer}</DialogTitle>
          </DialogHeader>
          {qrUnit && (
            <div className="flex flex-col items-center space-y-3 py-2">
              <div className="rounded-2xl border border-slate-300 bg-white p-3 dark:border-slate-600 dark:bg-slate-900">
                <QRCodeCanvas
                  value={qrUnit.barcode ?? qrUnit.seriennummer}
                  size={180}
                  level="M"
                  marginSize={2}
                  bgColor="#ffffff"
                  fgColor="#111827"
                />
              </div>
              <p className="font-mono text-xs text-slate-500">{qrUnit.barcode ?? '-'}</p>
              <p className="font-mono text-sm font-semibold">SN: {qrUnit.seriennummer}</p>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => handleUnitQrPrint(qrUnit)}>
                  <Printer className="h-4 w-4 mr-1" /> Drucken
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => handleUnitQrDownload(qrUnit)}>
                  <Download className="h-4 w-4 mr-1" /> PNG
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
