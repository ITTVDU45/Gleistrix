'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Download, QrCode, Printer, FileDown } from 'lucide-react'
import type { Article, ArticleUnit } from '@/types/main'
import { QRCodeCanvas } from 'qrcode.react'
import QRCode from 'qrcode'
import { LagerApi } from '@/lib/api/lager'
import ArticleUnitsSection from './ArticleUnitsSection'

interface ArticleDetailsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  article: Article | null
  onArticleUpdated?: () => void
}

function toSafeFileName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'produkt'
}

function getCategoryDisplay(article: Article): string {
  const top = (article.kategorie ?? '').trim()
  const sub = (article.unterkategorie ?? '').trim()
  if (top && sub) return `${top} > ${sub}`
  return top || '-'
}

export default function ArticleDetailsDialog({ open, onOpenChange, article, onArticleUpdated }: ArticleDetailsDialogProps) {
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState('')
  const [units, setUnits] = useState<ArticleUnit[]>([])
  const [unitsLoading, setUnitsLoading] = useState(false)

  const isIndividual = article?.serialTracking === 'individual'
  const articleId = article?.id ?? (article as { _id?: string } | null)?._id?.toString?.() ?? ''

  const loadUnits = useCallback(async () => {
    if (!isIndividual || !articleId) return
    setUnitsLoading(true)
    try {
      const res = await LagerApi.units.list(articleId)
      setUnits(res.units ?? [])
    } catch {
      setUnits([])
    } finally {
      setUnitsLoading(false)
    }
  }, [isIndividual, articleId])

  useEffect(() => {
    if (open && isIndividual) loadUnits()
    if (!open) setUnits([])
  }, [open, isIndividual, loadUnits])

  const qrValue = useMemo(
    () => String((article as { barcode?: string } | null)?.barcode ?? article?.artikelnummer ?? '').trim(),
    [article]
  )
  const displayCode = qrValue || '-'
  const seriennummer = (article as { seriennummer?: string })?.seriennummer?.trim() ?? ''

  if (!article) return null

  const handleDownloadQr = async () => {
    if (!qrValue) return

    setIsDownloading(true)
    setDownloadError('')
    try {
      const qrSize = 1024
      const dataUrl = await QRCode.toDataURL(qrValue, {
        width: qrSize,
        margin: 2,
        errorCorrectionLevel: 'M'
      })

      const canvas = document.createElement('canvas')
      const padding = 24
      const textHeight = seriennummer ? 56 : 0
      const totalHeight = qrSize + padding * 2 + textHeight
      canvas.width = qrSize + padding * 2
      canvas.height = totalHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Canvas nicht verfügbar')

      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      const img = new Image()
      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          ctx.drawImage(img, padding, padding, qrSize, qrSize)
          resolve()
        }
        img.onerror = () => reject(new Error('Bild konnte nicht geladen werden'))
        img.src = dataUrl
      })

      if (seriennummer) {
        ctx.fillStyle = '#111827'
        ctx.font = 'bold 32px system-ui, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(`Seriennummer: ${seriennummer}`, canvas.width / 2, qrSize + padding + 40)
      }

      const link = document.createElement('a')
      link.href = canvas.toDataURL('image/png')
      link.download = `${toSafeFileName(article.bezeichnung ?? article.artikelnummer ?? 'produkt')}-qr.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : 'QR-Code konnte nicht heruntergeladen werden')
    } finally {
      setIsDownloading(false)
    }
  }

  const handlePrint = async () => {
    if (!qrValue) return
    try {
      const dataUrl = await QRCode.toDataURL(qrValue, {
        width: 400,
        margin: 2,
        errorCorrectionLevel: 'M'
      })
      const win = window.open('', '_blank')
      if (!win) return
      win.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>QR - ${(article.bezeichnung ?? article.artikelnummer ?? 'Artikel').replace(/</g, '')}</title>
            <style>
              body { font-family: system-ui, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 24px; }
              .qr-wrap { margin-bottom: 16px; }
              .qr-wrap img { display: block; }
              .seriennummer { font-size: 18px; font-weight: 600; letter-spacing: 0.05em; margin: 0 0 8px 0; }
              .meta { font-size: 12px; color: #666; }
              @media print { body { padding: 16px; } }
            </style>
          </head>
          <body>
            <div class="qr-wrap">
              <img src="${dataUrl.replace(/"/g, '&quot;')}" alt="QR-Code" width="200" height="200" />
            </div>
            ${seriennummer ? `<p class="seriennummer">Seriennummer: ${seriennummer.replace(/</g, '&lt;')}</p>` : ''}
            <p class="meta">${(article.bezeichnung ?? '').replace(/</g, '&lt;')} · ${(article.artikelnummer ?? '').replace(/</g, '&lt;')}</p>
          </body>
        </html>
      `)
      win.document.close()
      win.focus()
      setTimeout(() => {
        win.print()
        win.close()
      }, 300)
    } catch (_) {}
  }

  const generateUnitCanvas = async (unit: ArticleUnit): Promise<HTMLCanvasElement> => {
    const code = unit.barcode ?? unit.seriennummer
    const qrSize = 512
    const dataUrl = await QRCode.toDataURL(code, { width: qrSize, margin: 2, errorCorrectionLevel: 'M' })
    const padding = 16
    const textHeight = 48
    const canvas = document.createElement('canvas')
    canvas.width = qrSize + padding * 2
    canvas.height = qrSize + padding * 2 + textHeight
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => { ctx.drawImage(img, padding, padding, qrSize, qrSize); resolve() }
      img.onerror = () => reject()
      img.src = dataUrl
    })
    ctx.fillStyle = '#111827'
    ctx.font = 'bold 22px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(`SN: ${unit.seriennummer}`, canvas.width / 2, qrSize + padding + 32)
    return canvas
  }

  const handleBulkDownloadPng = async () => {
    if (units.length === 0) return
    setIsDownloading(true)
    setDownloadError('')
    try {
      const cols = Math.min(units.length, 4)
      const rows = Math.ceil(units.length / cols)
      const cellW = 544
      const cellH = 576
      const megaCanvas = document.createElement('canvas')
      megaCanvas.width = cols * cellW
      megaCanvas.height = rows * cellH
      const megaCtx = megaCanvas.getContext('2d')!
      megaCtx.fillStyle = '#ffffff'
      megaCtx.fillRect(0, 0, megaCanvas.width, megaCanvas.height)

      for (let i = 0; i < units.length; i++) {
        const unitCanvas = await generateUnitCanvas(units[i])
        const col = i % cols
        const row = Math.floor(i / cols)
        megaCtx.drawImage(unitCanvas, col * cellW, row * cellH)
      }

      const link = document.createElement('a')
      link.href = megaCanvas.toDataURL('image/png')
      link.download = `${toSafeFileName(article?.bezeichnung ?? 'artikel')}-alle-qr-codes.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : 'Download fehlgeschlagen')
    } finally {
      setIsDownloading(false)
    }
  }

  const handleBulkPrint = async () => {
    if (units.length === 0) return
    try {
      const qrImages: { dataUrl: string; sn: string }[] = []
      for (const unit of units) {
        const code = unit.barcode ?? unit.seriennummer
        const dataUrl = await QRCode.toDataURL(code, { width: 300, margin: 2, errorCorrectionLevel: 'M' })
        qrImages.push({ dataUrl, sn: unit.seriennummer })
      }
      const win = window.open('', '_blank')
      if (!win) return
      const itemsHtml = qrImages.map((q) =>
        `<div class="item"><img src="${q.dataUrl.replace(/"/g, '&quot;')}" width="150" height="150"/><p class="sn">SN: ${q.sn.replace(/</g, '&lt;')}</p></div>`
      ).join('')
      win.document.write(`<!DOCTYPE html><html><head><title>QR-Codes - ${(article?.bezeichnung ?? '').replace(/</g, '&lt;')}</title>
        <style>
          body{font-family:system-ui,sans-serif;margin:0;padding:20px;}
          h1{font-size:16px;margin:0 0 16px;}
          .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:16px;}
          .item{display:flex;flex-direction:column;align-items:center;border:1px solid #e2e8f0;border-radius:8px;padding:12px;break-inside:avoid;}
          .item img{display:block;}
          .sn{font-size:13px;font-weight:600;margin:8px 0 0;font-family:monospace;}
          @media print{body{padding:10px;} .grid{gap:8px;} .item{border:1px solid #ccc;padding:8px;}}
        </style></head>
        <body><h1>${(article?.bezeichnung ?? '').replace(/</g, '&lt;')} - ${units.length} QR-Codes</h1>
        <div class="grid">${itemsHtml}</div></body></html>`)
      win.document.close()
      win.focus()
      setTimeout(() => { win.print(); win.close() }, 400)
    } catch {}
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`rounded-2xl ${article.serialTracking === 'individual' ? 'sm:max-w-2xl' : 'sm:max-w-lg'} max-h-[90vh] overflow-y-auto`}>
        <DialogHeader>
          <DialogTitle>Produktdetails - {article.bezeichnung}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="details" className="w-full">
          <TabsList className={`grid w-full rounded-xl ${article.serialTracking === 'individual' ? 'grid-cols-3' : 'grid-cols-2'}`}>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="qr">QR-Ansicht</TabsTrigger>
            {article.serialTracking === 'individual' && (
              <TabsTrigger value="units">Seriennummern</TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="details" className="space-y-3">
            <Card className="rounded-xl border-slate-200 dark:border-slate-700">
              <CardContent className="grid grid-cols-1 gap-2 p-4 text-sm sm:grid-cols-2">
                <p><span className="font-medium">Artikelnummer:</span> {article.artikelnummer || '-'}</p>
                <p><span className="font-medium">Kategorie:</span> {getCategoryDisplay(article)}</p>
                <p><span className="font-medium">Typ:</span> {article.typ || '-'}</p>
                <p><span className="font-medium">Lagerort:</span> {article.lagerort || '-'}</p>
                <p><span className="font-medium">Bestand:</span> {article.bestand ?? 0}</p>
                <p><span className="font-medium">Status:</span> {article.status || 'aktiv'}</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="qr" className="space-y-3">
            {/* Einzelner Artikel-QR-Code -- nur wenn KEIN individual tracking */}
            {!isIndividual && (
              <Card className="rounded-xl border-slate-200 dark:border-slate-700">
                <CardContent className="space-y-4 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Artikel QR-Code</p>
                    <Badge variant="outline">Payload: Barcode</Badge>
                  </div>

                  {qrValue ? (
                    <div className="mx-auto flex h-56 w-56 items-center justify-center rounded-2xl border border-slate-300 bg-white p-3 dark:border-slate-600 dark:bg-slate-900">
                      <QRCodeCanvas
                        value={qrValue}
                        size={190}
                        level="M"
                        marginSize={2}
                        bgColor="#ffffff"
                        fgColor="#111827"
                      />
                    </div>
                  ) : (
                    <div className="mx-auto flex h-56 w-56 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-center dark:border-slate-600 dark:bg-slate-800/40">
                      <QrCode className="h-10 w-10 text-slate-400 dark:text-slate-500" />
                      <p className="mt-2 px-3 text-xs text-slate-500 dark:text-slate-400">Kein QR-Wert vorhanden (Barcode/Artikelnummer fehlt)</p>
                    </div>
                  )}

                  <div className="rounded-lg bg-slate-100 p-3 dark:bg-slate-800">
                    <p className="text-xs text-slate-600 dark:text-slate-400">Code-Wert</p>
                    <p className="mt-1 break-all font-mono text-sm text-slate-900 dark:text-slate-100">{displayCode}</p>
                  </div>

                  {seriennummer ? (
                    <div className="rounded-lg bg-slate-100 p-3 dark:bg-slate-800">
                      <p className="text-xs text-slate-600 dark:text-slate-400">Seriennummer</p>
                      <p className="mt-1 font-mono text-sm font-medium text-slate-900 dark:text-slate-100">{seriennummer}</p>
                    </div>
                  ) : null}

                  <div className="flex flex-wrap justify-end gap-2">
                    <Button type="button" variant="outline" onClick={handlePrint} disabled={!qrValue}>
                      <Printer className="mr-2 h-4 w-4" />
                      Drucken
                    </Button>
                    <Button type="button" variant="outline" onClick={handleDownloadQr} disabled={!qrValue || isDownloading}>
                      <Download className="mr-2 h-4 w-4" />
                      {isDownloading ? 'Erstelle PNG...' : 'QR als PNG herunterladen'}
                    </Button>
                  </div>

                  {downloadError && (
                    <p className="text-xs text-red-600 dark:text-red-400">{downloadError}</p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Einzel-QR-Codes -- nur bei individual tracking */}
            {isIndividual && (
              <Card className="rounded-xl border-slate-200 dark:border-slate-700">
                <CardContent className="space-y-4 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Einzel-QR-Codes ({units.length} Geraete)
                    </p>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={handleBulkPrint} disabled={units.length === 0}>
                        <Printer className="mr-1 h-3.5 w-3.5" />
                        Alle drucken
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={handleBulkDownloadPng} disabled={units.length === 0 || isDownloading}>
                        <FileDown className="mr-1 h-3.5 w-3.5" />
                        {isDownloading ? 'Erstelle PNG...' : 'Alle als PNG'}
                      </Button>
                    </div>
                  </div>

                  {unitsLoading ? (
                    <p className="text-sm text-slate-500 text-center py-4">Lade Seriennummern...</p>
                  ) : units.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-4">Keine Seriennummern vorhanden</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {units.map((unit) => {
                        const code = unit.barcode ?? unit.seriennummer
                        return (
                          <div
                            key={unit.id ?? unit._id}
                            className="flex flex-col items-center rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900"
                          >
                            <QRCodeCanvas
                              value={code}
                              size={100}
                              level="M"
                              marginSize={1}
                              bgColor="#ffffff"
                              fgColor="#111827"
                            />
                            <p className="mt-2 font-mono text-xs font-semibold text-slate-800 dark:text-slate-200 text-center break-all">
                              {unit.seriennummer}
                            </p>
                            <p className="font-mono text-[10px] text-slate-400">{unit.barcode ?? ''}</p>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>
          {article.serialTracking === 'individual' && (
            <TabsContent value="units" className="space-y-3">
              <ArticleUnitsSection
                articleId={article.id ?? (article as { _id?: string })._id?.toString?.() ?? ''}
                articleBezeichnung={article.bezeichnung}
                onStockChanged={onArticleUpdated}
              />
            </TabsContent>
          )}
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}


