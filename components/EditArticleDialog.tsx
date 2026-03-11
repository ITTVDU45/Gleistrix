'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from './ui/select'
import type { Article, Category, ArticleTyp, ArticleZustand } from '@/types/main'
import { LagerApi } from '@/lib/api/lager'
import { ArticleImageSection } from './lager/ArticleImageSection'

const TYP_OPTIONS: ArticleTyp[] = [
  'Werkzeug',
  'Maschine',
  'Akku',
  'Komponente',
  'Verbrauch',
  'Sonstiges'
]
const ZUSTAND_OPTIONS: ArticleZustand[] = ['neu', 'gut', 'gebraucht', 'defekt']

interface EditArticleDialogProps {
  article: Article
  categories: Category[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

interface CategoryOption {
  id: string
  topId: string
  topName: string
  subName: string
  label: string
}

function toId(value: unknown): string {
  if (!value) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'object') {
    const record = value as { $oid?: unknown; _id?: unknown; toString?: () => string }
    if (typeof record.$oid === 'string') return record.$oid
    if (typeof record._id === 'string') return record._id
    if (typeof record.toString === 'function') {
      const str = record.toString()
      if (str && str !== '[object Object]') return str
    }
  }
  return ''
}

function getCategoryId(category: Category): string {
  return toId((category as { _id?: unknown })._id) || toId(category.id)
}

function getParentId(category: Category): string {
  return toId(category.parentId)
}

export default function EditArticleDialog({
  article,
  categories,
  open,
  onOpenChange,
  onSuccess
}: EditArticleDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [currentArticle, setCurrentArticle] = useState<Article | null>(null)
  const [selectedCategoryId, setSelectedCategoryId] = useState('')
  const [selectedTopCategoryId, setSelectedTopCategoryId] = useState('')
  const [selectedSubCategoryId, setSelectedSubCategoryId] = useState('')
  const [form, setForm] = useState<Partial<Article>>({
    artikelnummer: '',
    bezeichnung: '',
    kategorie: '',
    unterkategorie: '',
    typ: 'Werkzeug',
    bestand: 0,
    mindestbestand: 0,
    lagerort: '',
    seriennummer: '',
    zustand: 'gut',
    status: 'aktiv'
  })

  const topLevelCategories = useMemo(
    () =>
      categories
        .filter((category) => !getParentId(category))
        .sort((a, b) => a.name.localeCompare(b.name, 'de')),
    [categories]
  )

  const subCategories = useMemo(
    () =>
      categories
        .filter((category) => getParentId(category) === selectedTopCategoryId)
        .sort((a, b) => a.name.localeCompare(b.name, 'de')),
    [categories, selectedTopCategoryId]
  )

  const categoryOptions = useMemo(() => {
    const options: CategoryOption[] = []
    const childrenByParent = new Map<string, Category[]>()

    for (const category of categories) {
      const parentId = getParentId(category)
      if (!parentId) continue
      const bucket = childrenByParent.get(parentId) ?? []
      bucket.push(category)
      childrenByParent.set(parentId, bucket)
    }

    for (const top of topLevelCategories) {
      const topId = getCategoryId(top)
      if (!topId) continue

      options.push({
        id: topId,
        topId,
        topName: top.name,
        subName: '',
        label: top.name
      })

      const children = (childrenByParent.get(topId) ?? []).sort((a, b) => a.name.localeCompare(b.name, 'de'))
      for (const child of children) {
        const childId = getCategoryId(child)
        if (!childId) continue
        options.push({
          id: childId,
          topId,
          topName: top.name,
          subName: child.name,
          label: `${top.name} > ${child.name}`
        })
      }
    }

    return options
  }, [categories, topLevelCategories])

  useEffect(() => {
    if (open && article) {
      setCurrentArticle(article)
      const nextForm: Partial<Article> = {
        artikelnummer: article.artikelnummer ?? '',
        bezeichnung: article.bezeichnung ?? '',
        kategorie: article.kategorie ?? '',
        unterkategorie: article.unterkategorie ?? '',
        typ: article.typ ?? 'Werkzeug',
        bestand: article.bestand ?? 0,
        mindestbestand: article.mindestbestand ?? 0,
        lagerort: article.lagerort ?? '',
        seriennummer: article.seriennummer ?? '',
        zustand: article.zustand ?? 'gut',
        status: article.status ?? 'aktiv'
      }
      setForm(nextForm)

      const topMatch = topLevelCategories.find((cat) => cat.name === (article.kategorie ?? ''))
      const topId = topMatch ? getCategoryId(topMatch) : ''
      const subMatch = categories.find(
        (cat) =>
          !!getParentId(cat) &&
          cat.name === (article.unterkategorie ?? '') &&
          getParentId(cat) === topId
      )
      const subId = subMatch ? getCategoryId(subMatch) : ''

      setSelectedTopCategoryId(topId)
      setSelectedSubCategoryId(subId)
      setSelectedCategoryId(subId || topId)
    }
  }, [open, article, categories, topLevelCategories])

  useEffect(() => {
    if (!selectedCategoryId) return
    const selectedExists = categoryOptions.some((option) => option.id === selectedCategoryId)
    if (!selectedExists) {
      setSelectedCategoryId('')
      setSelectedTopCategoryId('')
      setSelectedSubCategoryId('')
      setForm((prev) => ({ ...prev, kategorie: '', unterkategorie: '' }))
    }
  }, [categoryOptions, selectedCategoryId])

  const refreshArticleInDialog = async () => {
    const id = article.id ?? (article as { _id?: string })._id?.toString?.()
    if (!id) return
    try {
      const res = await LagerApi.articles.get(id)
      const data = (res as { data?: Article })?.data
      if (data) setCurrentArticle(data)
    } catch (_) {}
    onSuccess()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const id = article.id ?? (article as { _id?: string })._id?.toString?.()
    if (!id) return

    if (!form.artikelnummer?.trim() || !form.bezeichnung?.trim() || !form.kategorie?.trim()) {
      setError('Artikelnummer, Bezeichnung und Kategorie sind Pflichtfelder.')
      return
    }

    setIsSubmitting(true)
    setError('')

    try {
      const res = await LagerApi.articles.update(id, {
        ...form,
        artikelnummer: form.artikelnummer!,
        bezeichnung: form.bezeichnung!,
        kategorie: form.kategorie!,
        unterkategorie: form.unterkategorie ?? '',
        typ: form.typ ?? 'Werkzeug',
        bestand: form.bestand ?? 0,
        mindestbestand: form.mindestbestand ?? 0,
        zustand: form.zustand ?? 'gut',
        status: form.status ?? 'aktiv'
      })
      if ((res as { success?: boolean }).success !== false) {
        onOpenChange(false)
        onSuccess()
      } else {
        setError((res as { message?: string }).message ?? 'Fehler beim Speichern')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Fehler beim Speichern')
    } finally {
      setIsSubmitting(false)
    }
  }

  const update = (field: keyof Article, value: string | number | undefined) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const selectCategoryByOption = (optionId: string) => {
    setSelectedCategoryId(optionId)
    const option = categoryOptions.find((entry) => entry.id === optionId)
    if (!option) return

    setSelectedTopCategoryId(option.topId)
    const sub = option.subName || ''
    setSelectedSubCategoryId(sub ? option.id : '')
    setForm((prev) => ({
      ...prev,
      kategorie: option.topName,
      unterkategorie: sub
    }))
  }

  const syncTopCategory = (categoryId: string) => {
    setSelectedTopCategoryId(categoryId)
    const category = categories.find((c) => getCategoryId(c) === categoryId)
    setSelectedSubCategoryId('')

    if (category) {
      setSelectedCategoryId(categoryId)
      setForm((prev) => ({
        ...prev,
        kategorie: category.name,
        unterkategorie: ''
      }))
    }
  }

  const syncSubCategory = (categoryId: string) => {
    setSelectedSubCategoryId(categoryId)
    const category = categories.find((c) => getCategoryId(c) === categoryId)
    if (!category) return

    setSelectedCategoryId(categoryId)
    setForm((prev) => ({
      ...prev,
      unterkategorie: category.name
    }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg rounded-2xl border-0 shadow-2xl bg-white dark:bg-slate-800 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-4 border-b border-slate-100 dark:border-slate-700">
          <DialogTitle className="text-xl font-semibold text-slate-900 dark:text-white">
            Artikel bearbeiten
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          {error && (
            <div className="rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm p-3">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-artikelnummer">Artikelnummer *</Label>
              <Input
                id="edit-artikelnummer"
                value={form.artikelnummer ?? ''}
                onChange={(e) => update('artikelnummer', e.target.value)}
                className="rounded-xl h-10"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-bezeichnung">Bezeichnung *</Label>
              <Input
                id="edit-bezeichnung"
                value={form.bezeichnung ?? ''}
                onChange={(e) => update('bezeichnung', e.target.value)}
                className="rounded-xl h-10"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Kategorie *</Label>
            <Select value={selectedCategoryId} onValueChange={selectCategoryByOption}>
              <SelectTrigger className="rounded-xl h-10">
                <SelectValue placeholder="Kategorie waehlen" />
              </SelectTrigger>
              <SelectContent>
                {categoryOptions.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(form.kategorie || form.unterkategorie) && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Oberkategorie: {form.kategorie || '-'} | Unterkategorie: {form.unterkategorie || '-'}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Oberkategorie *</Label>
              <Select value={selectedTopCategoryId} onValueChange={syncTopCategory}>
                <SelectTrigger className="rounded-xl h-10">
                  <SelectValue placeholder="Oberkategorie waehlen" />
                </SelectTrigger>
                <SelectContent>
                  {topLevelCategories.map((category) => {
                    const categoryId = getCategoryId(category)
                    if (!categoryId) return null
                    return (
                      <SelectItem key={categoryId} value={categoryId}>
                        {category.name}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Unterkategorie</Label>
              <Select
                value={selectedSubCategoryId || 'none'}
                onValueChange={(v) => {
                  if (v === 'none') {
                    setSelectedSubCategoryId('')
                    setSelectedCategoryId(selectedTopCategoryId)
                    setForm((prev) => ({ ...prev, unterkategorie: '' }))
                    return
                  }
                  syncSubCategory(v)
                }}
                disabled={!selectedTopCategoryId}
              >
                <SelectTrigger className="rounded-xl h-10">
                  <SelectValue placeholder={selectedTopCategoryId ? 'Unterkategorie waehlen' : 'Erst Oberkategorie waehlen'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Keine Unterkategorie</SelectItem>
                  {subCategories.map((category) => {
                    const categoryId = getCategoryId(category)
                    if (!categoryId) return null
                    return (
                      <SelectItem key={categoryId} value={categoryId}>
                        {category.name}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Typ *</Label>
              <Select
                value={form.typ ?? 'Werkzeug'}
                onValueChange={(v) => update('typ', v as ArticleTyp)}
              >
                <SelectTrigger className="rounded-xl h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYP_OPTIONS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-lagerort">Lagerort</Label>
              <Input
                id="edit-lagerort"
                value={form.lagerort ?? ''}
                onChange={(e) => update('lagerort', e.target.value)}
                className="rounded-xl h-10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-seriennummer">Seriennummer</Label>
              <Input
                id="edit-seriennummer"
                value={form.seriennummer ?? ''}
                onChange={(e) => update('seriennummer', e.target.value)}
                className="rounded-xl h-10"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Zustand</Label>
              <Select
                value={form.zustand ?? 'gut'}
                onValueChange={(v) => update('zustand', v as ArticleZustand)}
              >
                <SelectTrigger className="rounded-xl h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ZUSTAND_OPTIONS.map((z) => (
                    <SelectItem key={z} value={z}>
                      {z}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-bestand">Bestand (aktuell)</Label>
              <Input
                id="edit-bestand"
                type="number"
                min={0}
                value={form.bestand ?? 0}
                onChange={(e) => update('bestand', parseInt(e.target.value, 10) || 0)}
                className="rounded-xl h-10"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400">Aktueller Lagerbestand (wird in der Tabelle angezeigt)</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-mindestbestand">Mindestbestand</Label>
              <Input
                id="edit-mindestbestand"
                type="number"
                min={0}
                value={form.mindestbestand ?? 0}
                onChange={(e) => update('mindestbestand', parseInt(e.target.value, 10) || 0)}
                className="rounded-xl h-10"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400">Schwellwert fuer Warnung "Unter Mindestbestand"</p>
            </div>
          </div>

          {(article.id ?? (article as { _id?: string })._id) && (
            <ArticleImageSection
              articleId={article.id ?? (article as { _id?: string })._id?.toString?.() ?? ''}
              images={currentArticle?.images ?? article.images}
              onUpdate={refreshArticleInDialog}
              disabled={isSubmitting}
            />
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Wird gespeichert...' : 'Speichern'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
