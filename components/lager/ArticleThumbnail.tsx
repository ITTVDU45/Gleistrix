'use client'

import React, { useState, useEffect } from 'react'
import { LagerApi } from '@/lib/api/lager'
import type { ArticleImage } from '@/types/main'
import { Package } from 'lucide-react'

interface ArticleThumbnailProps {
  articleId: string
  images: ArticleImage[] | undefined
  className?: string
}

export function ArticleThumbnail({ articleId, images, className = '' }: ArticleThumbnailProps) {
  const [url, setUrl] = useState<string | null>(null)
  const first = images && images.length > 0 ? images[0] : null

  useEffect(() => {
    if (!articleId || !first) return
    let cancelled = false
    LagerApi.articles.getImageUrl(articleId, first.attachmentId).then((res) => {
      if (cancelled) return
      if ((res as { url?: string })?.url) setUrl((res as { url: string }).url)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [articleId, first?.attachmentId])

  if (!first) {
    return (
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-400 ${className}`}
        title="Kein Bild"
      >
        <Package className="h-5 w-5" />
      </div>
    )
  }

  if (url) {
    return (
      <img
        src={url}
        alt=""
        className={`h-10 w-10 shrink-0 rounded-lg object-cover border border-slate-200 dark:border-slate-600 ${className}`}
      />
    )
  }

  return (
    <div
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-700 animate-pulse ${className}`}
    >
      <Package className="h-4 w-4 text-slate-400" />
    </div>
  )
}
