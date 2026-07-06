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
import { buildQrLabel } from '@/lib/lager/qrLabel'
import { buildLagerScanUrl } from '@/lib/lager/scanUrl'
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

  const [origin, setOrigin] = useState('')
  useEffect(() => {
    if (typeof window !== 'undefined') setOrigin(window.location.origin)
  }, [])

  const qrValue = useMemo(
    () => String((article as { barcode?: string } | null)?.barcode ?? article?.artikelnummer ?? '').trim(),
    [article]
  )
  // QR-Inhalt = Scan-URL zum Artikel in der Lager-App (Fallback: Code-Text)
  const qrPayload = useMemo(
    () => buildLagerScanUrl(articleId, undefined, origin) || qrValue,
    [articleId, origin, qrValue]
  )
  const displayCode = qrValue || '-'
  const seriennummer = (article as { seriennummer?: string })?.seriennummer?.trim() ?? ''
  const qrLabel = useMemo(() => buildQrLabel({
    kategorie: article?.kategorie,
    unterkategorie: article?.unterkategorie,
    artikelnummer: article?.artikelnummer,
    seriennummer,
  }), [article, seriennummer])

  if (!article) return null

  const LABEL_PX_W = 600
  const LABEL_PX_H = 300
  const QR_PX = 220
  const QR_PAD = 40

  const drawLabelCanvas = async (
    qrData: string,
    labelLine1: string,
    labelLine2: string | null,
  ): Promise<HTMLCanvasElement> => {
    const dataUrl = await QRCode.toDataURL(qrData, { width: QR_PX, margin: 1, errorCorrectionLevel: 'M' })
    const canvas = document.createElement('canvas')
    canvas.width = LABEL_PX_W
    canvas.height = LABEL_PX_H
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, LABEL_PX_W, LABEL_PX_H)
    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => { ctx.drawImage(img, QR_PAD, QR_PAD, QR_PX, QR_PX); resolve() }
      img.onerror = () => reject(new Error('Bild konnte nicht geladen werden'))
      img.src = dataUrl
    })
    const textX = QR_PAD + QR_PX + 20
    const textMaxW = LABEL_PX_W - textX - 10
    ctx.fillStyle = '#111827'
    ctx.font = 'bold 22px system-ui, sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText(labelLine1, textX, 120, textMaxW)
    if (labelLine2) {
      ctx.font = '19px system-ui, sans-serif'
      ctx.fillText(labelLine2, textX, 155, textMaxW)
    }
    return canvas
  }

  const handleDownloadQr = async () => {
    if (!qrValue) return
    setIsDownloading(true)
    setDownloadError('')
    try {
      const canvas = await drawLabelCanvas(qrPayload, qrLabel.line1, qrLabel.line2)
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

  const labelPrintHtml = (dataUrl: string, line1: string, line2: string | null): string => {
    const safeLine1 = line1.replace(/</g, '&lt;')
    const safeLine2 = line2 ? line2.replace(/</g, '&lt;') : ''
    return `<!DOCTYPE html><html><head><title>Etikett</title>
      <style>
        @page{size:50.8mm 25.4mm;margin:0;}
        *{margin:0;padding:0;box-sizing:border-box;}
        body{font-family:system-ui,sans-serif;width:50.8mm;height:25.4mm;display:flex;align-items:center;padding:2mm;}
        .qr{flex-shrink:0;width:19mm;height:19mm;margin-right:2mm;}
        .qr img{width:100%;height:100%;display:block;}
        .text{display:flex;flex-direction:column;justify-content:center;overflow:hidden;}
        .l1{font-size:7pt;font-weight:700;line-height:1.3;word-break:break-word;}
        .l2{font-size:6.5pt;font-weight:400;color:#333;margin-top:1mm;line-height:1.2;}
      </style></head>
      <body>
        <div class="qr"><img src="${dataUrl.replace(/"/g, '&quot;')}" /></div>
        <div class="text">
          <p class="l1">${safeLine1}</p>
          ${safeLine2 ? `<p class="l2">${safeLine2}</p>` : ''}
        </div>
      </body></html>`
  }

  const handlePrint = async () => {
    if (!qrValue) return
    try {
      const dataUrl = await QRCode.toDataURL(qrPayload, { width: 400, margin: 1, errorCorrectionLevel: 'M' })
      const win = window.open('', '_blank')
      if (!win) return
      win.document.write(labelPrintHtml(dataUrl, qrLabel.line1, qrLabel.line2))
      win.document.close()
      win.focus()
      setTimeout(() => { win.print(); win.close() }, 300)
    } catch (_) {}
  }

  const unitScanUrl = (unit: ArticleUnit): string => {
    const uid = unit.id ?? unit._id ?? ''
    return buildLagerScanUrl(articleId, uid, origin) || (unit.barcode ?? unit.seriennummer)
  }

  const generateUnitCanvas = async (unit: ArticleUnit): Promise<HTMLCanvasElement> => {
    return drawLabelCanvas(unitScanUrl(unit), qrLabel.line1, unit.seriennummer)
  }

  const handleBulkDownloadPng = async () => {
    if (units.length === 0) return
    setIsDownloading(true)
    setDownloadError('')
    try {
      const cols = Math.min(units.length, 3)
      const rows = Math.ceil(units.length / cols)
      const gap = 4
      const megaCanvas = document.createElement('canvas')
      megaCanvas.width = cols * LABEL_PX_W + (cols - 1) * gap
      megaCanvas.height = rows * LABEL_PX_H + (rows - 1) * gap
      const megaCtx = megaCanvas.getContext('2d')!
      megaCtx.fillStyle = '#ffffff'
      megaCtx.fillRect(0, 0, megaCanvas.width, megaCanvas.height)

      for (let i = 0; i < units.length; i++) {
        const unitCanvas = await generateUnitCanvas(units[i])
        const col = i % cols
        const row = Math.floor(i / cols)
        megaCtx.drawImage(unitCanvas, col * (LABEL_PX_W + gap), row * (LABEL_PX_H + gap))
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
        const dataUrl = await QRCode.toDataURL(unitScanUrl(unit), { width: 400, margin: 1, errorCorrectionLevel: 'M' })
        qrImages.push({ dataUrl, sn: unit.seriennummer })
      }
      const win = window.open('', '_blank')
      if (!win) return
      const safeLabel = qrLabel.line1.replace(/</g, '&lt;')
      const itemsHtml = qrImages.map((q) =>
        `<div class="label">
          <div class="qr"><img src="${q.dataUrl.replace(/"/g, '&quot;')}" /></div>
          <div class="text"><p class="l1">${safeLabel}</p><p class="l2">${q.sn.replace(/</g, '&lt;')}</p></div>
        </div>`
      ).join('')
      win.document.write(`<!DOCTYPE html><html><head><title>Etiketten</title>
        <style>
          @page{size:50.8mm 25.4mm;margin:0;}
          *{margin:0;padding:0;box-sizing:border-box;}
          body{font-family:system-ui,sans-serif;}
          .label{width:50.8mm;height:25.4mm;display:flex;align-items:center;padding:2mm;page-break-after:always;overflow:hidden;}
          .qr{flex-shrink:0;width:19mm;height:19mm;margin-right:2mm;}
          .qr img{width:100%;height:100%;display:block;}
          .text{display:flex;flex-direction:column;justify-content:center;overflow:hidden;}
          .l1{font-size:7pt;font-weight:700;line-height:1.3;word-break:break-word;}
          .l2{font-size:6.5pt;font-weight:400;color:#333;margin-top:1mm;line-height:1.2;}
        </style></head>
        <body>${itemsHtml}</body></html>`)
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
                    <Badge variant="outline">Scan öffnet Lager-App</Badge>
                  </div>

                  {qrValue ? (
                    <div className="mx-auto flex h-56 w-56 items-center justify-center rounded-2xl border border-slate-300 bg-white p-3 dark:border-slate-600 dark:bg-slate-900">
                      <QRCodeCanvas
                        value={qrPayload}
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
                    <p className="text-xs text-slate-600 dark:text-slate-400">Beschriftung</p>
                    <p className="mt-1 font-mono text-sm font-semibold text-slate-900 dark:text-slate-100">{qrLabel.line1}</p>
                    {qrLabel.line2 && (
                      <p className="mt-0.5 font-mono text-sm text-slate-700 dark:text-slate-300">{qrLabel.line2}</p>
                    )}
                  </div>

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
                        return (
                          <div
                            key={unit.id ?? unit._id}
                            className="flex flex-col items-center rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900"
                          >
                            <QRCodeCanvas
                              value={unitScanUrl(unit)}
                              size={100}
                              level="M"
                              marginSize={1}
                              bgColor="#ffffff"
                              fgColor="#111827"
                            />
                            <p className="mt-2 font-mono text-[11px] font-semibold text-slate-800 dark:text-slate-200 text-center break-all">
                              {qrLabel.line1}
                            </p>
                            <p className="font-mono text-[10px] text-slate-500 dark:text-slate-400 text-center">{unit.seriennummer}</p>
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
                articleKategorie={article.kategorie}
                articleUnterkategorie={article.unterkategorie}
                articleArtikelnummer={article.artikelnummer}
                onStockChanged={onArticleUpdated}
              />
            </TabsContent>
          )}
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}


