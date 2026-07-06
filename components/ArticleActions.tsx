'use client'

import React, { useState } from 'react'
import { Button } from './ui/button'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import { MoreHorizontal, Edit, Archive, QrCode, FileDown, Trash2 } from 'lucide-react'
import type { Article, Category } from '@/types/main'
import { LagerApi } from '@/lib/api/lager'
import EditArticleDialog from './EditArticleDialog'
import ArticleDetailsDialog from '@/components/lager/ArticleDetailsDialog'

interface ArticleActionsProps {
  article: Article
  onRefresh: () => void
  categories?: Category[]
}

export default function ArticleActions({ article, onRefresh, categories = [] }: ArticleActionsProps) {
  const [editOpen, setEditOpen] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [popoverOpen, setPopoverOpen] = useState(false)
  const id = article.id ?? (article as { _id?: { toString?: () => string } })._id?.toString?.()

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

  const handleDelete = async () => {
    if (!id) return
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    setDeleting(true)
    try {
      await LagerApi.articles.delete(id)
      setPopoverOpen(false)
      setConfirmDelete(false)
      onRefresh()
    } catch (err) {
      console.error('Löschen fehlgeschlagen:', err)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <Popover open={popoverOpen} onOpenChange={(v) => { setPopoverOpen(v); if (!v) setConfirmDelete(false) }}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-52 p-1" align="end">
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
              setDetailsOpen(true)
            }}
          >
            <QrCode className="h-4 w-4" />
            Produktdetails / QR
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
              {archiving ? 'Archivieren...' : 'Archivieren'}
            </Button>
          )}
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
            size="sm"
            onClick={handleDelete}
            disabled={deleting}
          >
            <Trash2 className="h-4 w-4" />
            {confirmDelete ? 'Wirklich löschen?' : deleting ? 'Löschen...' : 'Löschen'}
          </Button>
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

      <ArticleDetailsDialog
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        article={article}
        onArticleUpdated={onRefresh}
      />
    </>
  )
}
