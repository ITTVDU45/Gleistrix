'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { LagerApi } from '@/lib/api/lager'
import type { ArticleImage } from '@/types/main'
import { ImagePlus, Trash2 } from 'lucide-react'

interface ArticleImageSectionProps {
  articleId: string
  images: ArticleImage[] | undefined
  onUpdate: () => void
  disabled?: boolean
}

export function ArticleImageSection({ articleId, images, onUpdate, disabled }: ArticleImageSectionProps) {
  const [uploading, setUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !articleId) return
    if (!file.type.startsWith('image/')) {
      return
    }
    setUploading(true)
    e.target.value = ''
    try {
      await LagerApi.articles.uploadImage(articleId, file)
      onUpdate()
    } catch (err) {
      console.error('Bild-Upload fehlgeschlagen:', err)
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (attachmentId: string) => {
    if (!articleId) return
    setDeletingId(attachmentId)
    try {
      await LagerApi.articles.deleteImage(articleId, attachmentId)
      onUpdate()
    } catch (err) {
      console.error('Bild löschen fehlgeschlagen:', err)
    } finally {
      setDeletingId(null)
    }
  }

  const list = images ?? []

  return (
    <div className="space-y-2">
      <Label>Bilder</Label>
      <div className="flex flex-wrap gap-3">
        {list.map((img) => (
          <ArticleImageThumbnail
            key={img.attachmentId}
            articleId={articleId}
            attachmentId={img.attachmentId}
            filename={img.filename}
            onDelete={() => handleDelete(img.attachmentId)}
            isDeleting={deletingId === img.attachmentId}
            disabled={disabled}
          />
        ))}
        {!disabled && (
          <label className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
              disabled={uploading}
            />
            {uploading ? (
              <span className="text-xs text-slate-500">Wird hochgeladen…</span>
            ) : (
              <>
                <ImagePlus className="h-6 w-6 text-slate-500 dark:text-slate-400 mb-1" />
                <span className="text-xs text-slate-600 dark:text-slate-400">Bild hinzufügen</span>
              </>
            )}
          </label>
        )}
      </div>
    </div>
  )
}

function ArticleImageThumbnail({
  articleId,
  attachmentId,
  filename,
  onDelete,
  isDeleting,
  disabled
}: {
  articleId: string
  attachmentId: string
  filename: string
  onDelete: () => void
  isDeleting: boolean
  disabled?: boolean
}) {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    LagerApi.articles.getImageUrl(articleId, attachmentId).then((res) => {
      if (cancelled) return
      if ((res as { url?: string })?.url) setUrl((res as { url: string }).url)
      else setError(true)
    }).catch(() => { if (!cancelled) setError(true) })
    return () => { cancelled = true }
  }, [articleId, attachmentId])

  return (
    <div className="relative group">
      <div className="h-24 w-24 rounded-xl border border-slate-200 dark:border-slate-600 overflow-hidden bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
        {url && <img src={url} alt={filename} className="h-full w-full object-cover" />}
        {error && <span className="text-xs text-slate-500 p-1">Fehler</span>}
        {!url && !error && <span className="text-xs text-slate-500">Lade…</span>}
      </div>
      {!disabled && (
        <Button
          type="button"
          variant="destructive"
          size="icon"
          className="absolute -top-1 -right-1 h-6 w-6 rounded-full opacity-90 group-hover:opacity-100"
          onClick={onDelete}
          disabled={isDeleting}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      )}
    </div>
  )
}
