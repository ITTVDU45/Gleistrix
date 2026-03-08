'use client'

import React, { useMemo, useState } from 'react'
import { Check, ChevronsUpDown, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import type { Article } from '@/types/main'

interface ArticleSelectProps {
  id?: string
  value: string
  onValueChange: (value: string) => void
  articles: Article[]
  placeholder?: string
  searchPlaceholder?: string
  triggerClassName?: string
  disabled?: boolean
}

function getArticleId(article: Article): string {
  const raw = (article as { _id?: unknown })._id ?? article.id
  return raw != null ? String(raw) : ''
}

export default function ArticleSelect({
  id,
  value,
  onValueChange,
  articles,
  placeholder = 'Artikel waehlen',
  searchPlaceholder = 'Artikel suchen...',
  triggerClassName,
  disabled = false
}: ArticleSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const selected = useMemo(
    () => articles.find((article) => getArticleId(article) === value) ?? null,
    [articles, value]
  )

  const filteredArticles = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('de-DE')
    if (!query) return articles
    return articles.filter((article) => {
      const bezeichnung = String(article.bezeichnung ?? '').toLocaleLowerCase('de-DE')
      const artikelnummer = String(article.artikelnummer ?? '').toLocaleLowerCase('de-DE')
      const barcode = String(article.barcode ?? '').toLocaleLowerCase('de-DE')
      return bezeichnung.includes(query) || artikelnummer.includes(query) || barcode.includes(query)
    })
  }, [articles, search])

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setSearch('')
      }}
    >
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn('w-full justify-between rounded-xl font-normal', triggerClassName)}
        >
          <span className="truncate text-slate-900 dark:text-slate-100">
            {selected ? `${selected.artikelnummer} - ${selected.bezeichnung}` : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <div className="border-b px-3 py-2">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-slate-500" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={searchPlaceholder}
              className="h-9 border-0 px-0 shadow-none focus-visible:ring-0"
            />
          </div>
        </div>

        <div className="max-h-72 overflow-y-auto p-1">
          {filteredArticles.length === 0 ? (
            <p className="px-2 py-3 text-sm text-slate-500">Keine passenden Artikel gefunden</p>
          ) : (
            filteredArticles.map((article) => {
              const articleId = getArticleId(article)
              const isActive = articleId === value
              return (
                <button
                  key={articleId}
                  type="button"
                  onClick={() => {
                    onValueChange(articleId)
                    setOpen(false)
                  }}
                  className={cn(
                    'flex w-full items-center rounded-md px-2 py-2 text-left text-sm text-slate-900 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800',
                    isActive && 'bg-slate-100 dark:bg-slate-800'
                  )}
                >
                  <Check className={cn('mr-2 h-4 w-4', isActive ? 'opacity-100' : 'opacity-0')} />
                  <span className="truncate">{article.artikelnummer} - {article.bezeichnung}</span>
                </button>
              )
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
