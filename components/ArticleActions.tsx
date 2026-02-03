'use client'

import React, { useState } from 'react'
import { Button } from './ui/button'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { MoreHorizontal, Edit, Archive, QrCode, FileDown } from 'lucide-react'
import type { Article } from '@/types/main'
import { LagerApi } from '@/lib/api/lager'
import EditArticleDialog from './EditArticleDialog'
import type { Category } from '@/types/main'

interface ArticleActionsProps {
  article: Article
  onRefresh: () => void
  categories?: Category[]
}

export default function ArticleActions({ article, onRefresh, categories = [] }: ArticleActionsProps) {
  const [editOpen, setEditOpen] = useState(false)
  const [barcodeOpen, setBarcodeOpen] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [popoverOpen, setPopoverOpen] = useState(false)
  const id = article.id ?? (article as any)._id?.toString?.()

  const handleArchive = async () => {
    if (!id) return
    setArchiving(true)
    try {
      await LagerApi.articles.archive(id)
      setPopoverOpen(false)
      onRefresh()
    } catch (err) {
      console.error('Archivieren fehlgeschlagen:', err)
    } finally {
      setArchiving(false)
    }
  }

  const barcode = (article as any).barcode ?? article.artikelnummer ?? '–'

  return (
    <>
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-1" align="end">
          <Button
            variant="ghost"
            className="w-full justify-start gap-2"
            size="sm"
            onClick={() => {
              setPopoverOpen(false)
              setEditOpen(true)
            }}
          >
            <Edit className="h-4 w-4" />
            Bearbeiten
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start gap-2"
            size="sm"
            onClick={() => {
              setPopoverOpen(false)
              setBarcodeOpen(true)
            }}
          >
            <QrCode className="h-4 w-4" />
            Barcode / QR anzeigen
          </Button>
          {id && (
            <Button
              variant="ghost"
              className="w-full justify-start gap-2"
              size="sm"
              onClick={() => {
                setPopoverOpen(false)
                window.open(`/api/lager/articles/${id}/label-pdf`, '_blank', 'noopener,noreferrer')
              }}
            >
              <FileDown className="h-4 w-4" />
              Etikett drucken (PDF)
            </Button>
          )}
          {(article.status ?? 'aktiv') === 'aktiv' && (
            <Button
              variant="ghost"
              className="w-full justify-start gap-2"
              size="sm"
              onClick={handleArchive}
              disabled={archiving}
            >
              <Archive className="h-4 w-4" />
              {archiving ? 'Archivieren…' : 'Archivieren'}
            </Button>
          )}
        </PopoverContent>
      </Popover>

      <EditArticleDialog
        article={article}
        categories={categories}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSuccess={() => {
          setEditOpen(false)
          onRefresh()
        }}
      />

      <Dialog open={barcodeOpen} onOpenChange={setBarcodeOpen}>
        <DialogContent className="sm:max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>Barcode / QR – {article.bezeichnung}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">Barcode / Artikel-ID</p>
            <p className="font-mono text-lg break-all rounded-lg bg-slate-100 dark:bg-slate-700 p-3">
              {barcode}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-500 mt-2">
              Scannen Sie diesen Code zur Schnellerfassung (z. B. Wareneingang, Ausgabe).
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
