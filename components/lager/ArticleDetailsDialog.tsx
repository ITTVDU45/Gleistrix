'use client'

import React, { useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Download, QrCode } from 'lucide-react'
import type { Article } from '@/types/main'
import { QRCodeCanvas } from 'qrcode.react'
import QRCode from 'qrcode'

interface ArticleDetailsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  article: Article | null
}

function toSafeFileName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'produkt'
}

export default function ArticleDetailsDialog({ open, onOpenChange, article }: ArticleDetailsDialogProps) {
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState('')

  const qrValue = useMemo(
    () => String((article as { barcode?: string } | null)?.barcode ?? article?.artikelnummer ?? '').trim(),
    [article]
  )
  const displayCode = qrValue || '-'

  if (!article) return null

  const handleDownloadQr = async () => {
    if (!qrValue) return

    setIsDownloading(true)
    setDownloadError('')
    try {
      const dataUrl = await QRCode.toDataURL(qrValue, {
        width: 1024,
        margin: 2,
        errorCorrectionLevel: 'M'
      })

      const link = document.createElement('a')
      link.href = dataUrl
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle>Produktdetails - {article.bezeichnung}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="details" className="w-full">
          <TabsList className="grid w-full grid-cols-2 rounded-xl">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="qr">QR-Ansicht</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-3">
            <Card className="rounded-xl border-slate-200 dark:border-slate-700">
              <CardContent className="grid grid-cols-1 gap-2 p-4 text-sm sm:grid-cols-2">
                <p><span className="font-medium">Artikelnummer:</span> {article.artikelnummer || '-'}</p>
                <p><span className="font-medium">Kategorie:</span> {article.kategorie || '-'}</p>
                <p><span className="font-medium">Typ:</span> {article.typ || '-'}</p>
                <p><span className="font-medium">Lagerort:</span> {article.lagerort || '-'}</p>
                <p><span className="font-medium">Bestand:</span> {article.bestand ?? 0}</p>
                <p><span className="font-medium">Status:</span> {article.status || 'aktiv'}</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="qr" className="space-y-3">
            <Card className="rounded-xl border-slate-200 dark:border-slate-700">
              <CardContent className="space-y-4 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">QR-Code (live generiert)</p>
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

                <div className="flex justify-end">
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
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
