'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from './ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from './ui/select'
import { Plus, Package, ImagePlus } from 'lucide-react'
import type { Article, Category, ArticleTyp, ArticleZustand } from '@/types/main'
import { LagerApi } from '@/lib/api/lager'
import AddCategoryDialog from './AddCategoryDialog'

const TYP_OPTIONS: ArticleTyp[] = [
  'Werkzeug',
  'Maschine',
  'Akku',
  'Komponente',
  'Verbrauch',
  'Sonstiges'
]
const ZUSTAND_OPTIONS: ArticleZustand[] = ['neu', 'gut', 'gebraucht', 'defekt']

interface AddArticleDialogProps {
  categories: Category[]
  onSuccess?: () => void
  onCategoriesChange?: () => Promise<void> | void
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

export default function AddArticleDialog({ categories, onSuccess, onCategoriesChange }: AddArticleDialogProps) {
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [pendingImages, setPendingImages] = useState<File[]>([])
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
    if (!selectedCategoryId) return
    const selectedExists = categoryOptions.some((option) => option.id === selectedCategoryId)
    if (!selectedExists) {
      setSelectedCategoryId('')
      setSelectedTopCategoryId('')
      setSelectedSubCategoryId('')
      setForm((prev) => ({ ...prev, kategorie: '', unterkategorie: '' }))
    }
  }, [categoryOptions, selectedCategoryId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.artikelnummer?.trim() || !form.bezeichnung?.trim() || !form.kategorie?.trim()) {
      setError('Artikelnummer, Bezeichnung und Kategorie sind Pflichtfelder.')
      return
    }

    setIsSubmitting(true)
    setError('')

    try {
      const res = await LagerApi.articles.create({
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
        const newArticle = (res as { data?: { _id?: string; id?: string } })?.data
        const newId = newArticle?._id?.toString?.() ?? (newArticle as { id?: string } | undefined)?.id
        if (newId && pendingImages.length > 0) {
          for (const file of pendingImages) {
            if (file.type.startsWith('image/')) {
              await LagerApi.articles.uploadImage(newId, file)
            }
          }
        }
        setPendingImages([])
        setSelectedCategoryId('')
        setSelectedTopCategoryId('')
        setSelectedSubCategoryId('')
        setForm({
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
        setOpen(false)
        onSuccess?.()
      } else {
        setError((res as { message?: string }).message ?? 'Fehler beim Anlegen des Artikels')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Fehler beim Anlegen des Artikels')
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

  const handleTopCategoryCreated = async (created?: Category) => {
    await onCategoriesChange?.()
    if (!created) return

    const createdId = getCategoryId(created)
    const parentId = getParentId(created)
    if (!createdId || parentId) return

    setSelectedCategoryId(createdId)
    setSelectedTopCategoryId(createdId)
    setSelectedSubCategoryId('')
    setForm((prev) => ({
      ...prev,
      kategorie: created.name,
      unterkategorie: ''
    }))
  }

  const handleSubCategoryCreated = async (created?: Category) => {
    await onCategoriesChange?.()
    if (!created || !selectedTopCategoryId) return

    const createdId = getCategoryId(created)
    if (!createdId) return

    if (getParentId(created) === selectedTopCategoryId) {
      setSelectedCategoryId(createdId)
      setSelectedSubCategoryId(createdId)
      setForm((prev) => ({
        ...prev,
        unterkategorie: created.name
      }))
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-200">
          <Plus className="h-4 w-4" />
          Artikel anlegen
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg rounded-2xl border-0 shadow-2xl bg-white dark:bg-slate-800 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-4 border-b border-slate-100 dark:border-slate-700">
          <DialogTitle className="flex items-center gap-3 text-xl font-semibold text-slate-900 dark:text-white">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
              <Package className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            Neuen Artikel anlegen
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
              <Label htmlFor="artikelnummer">Artikelnummer *</Label>
              <Input
                id="artikelnummer"
                value={form.artikelnummer ?? ''}
                onChange={(e) => update('artikelnummer', e.target.value)}
                placeholder="z.B. ART-001"
                className="rounded-xl h-10"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bezeichnung">Bezeichnung *</Label>
              <Input
                id="bezeichnung"
                value={form.bezeichnung ?? ''}
                onChange={(e) => update('bezeichnung', e.target.value)}
                placeholder="z.B. Akkuschrauber"
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
                {categoryOptions.length === 0 && (
                  <SelectItem value="_empty" disabled>
                    Keine Kategorien - zuerst anlegen
                  </SelectItem>
                )}
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
              <div className="flex items-center justify-between">
                <Label>Oberkategorie *</Label>
                <AddCategoryDialog
                  categories={categories}
                  onSuccess={handleTopCategoryCreated}
                  trigger={
                    <Button type="button" variant="outline" size="icon" className="h-8 w-8 rounded-lg" aria-label="Oberkategorie anlegen">
                      <Plus className="h-4 w-4" />
                    </Button>
                  }
                />
              </div>
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
                  {topLevelCategories.length === 0 && (
                    <SelectItem value="_empty" disabled>
                      Keine Oberkategorien - zuerst anlegen
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Unterkategorie</Label>
                <AddCategoryDialog
                  categories={categories}
                  defaultParentId={selectedTopCategoryId || null}
                  onSuccess={handleSubCategoryCreated}
                  trigger={
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 rounded-lg"
                      aria-label="Unterkategorie anlegen"
                      disabled={!selectedTopCategoryId}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  }
                />
              </div>
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
              <Label htmlFor="lagerort">Lagerort</Label>
              <Input
                id="lagerort"
                value={form.lagerort ?? ''}
                onChange={(e) => update('lagerort', e.target.value)}
                placeholder="z.B. Regal A1"
                className="rounded-xl h-10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="seriennummer">Seriennummer</Label>
              <Input
                id="seriennummer"
                value={form.seriennummer ?? ''}
                onChange={(e) => update('seriennummer', e.target.value)}
                placeholder="optional"
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
              <Label htmlFor="bestand">Bestand (aktuell)</Label>
              <Input
                id="bestand"
                type="number"
                min={0}
                value={form.bestand ?? 0}
                onChange={(e) => update('bestand', parseInt(e.target.value, 10) || 0)}
                className="rounded-xl h-10"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400">Anfangsbestand (wird in der Tabelle angezeigt)</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="mindestbestand">Mindestbestand</Label>
              <Input
                id="mindestbestand"
                type="number"
                min={0}
                value={form.mindestbestand ?? 0}
                onChange={(e) => update('mindestbestand', parseInt(e.target.value, 10) || 0)}
                className="rounded-xl h-10"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400">Schwellwert fuer Warnung "Unter Mindestbestand"</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Bilder (optional)</Label>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? [])
                    setPendingImages((prev) => [...prev, ...files.filter((f) => f.type.startsWith('image/'))])
                    e.target.value = ''
                  }}
                />
                <ImagePlus className="h-5 w-5 text-slate-500 dark:text-slate-400 mb-0.5" />
                <span className="text-xs text-slate-600 dark:text-slate-400">Hinzufuegen</span>
              </label>
              {pendingImages.length > 0 && (
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  {pendingImages.length} Bild(er) werden nach dem Anlegen hochgeladen
                </span>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
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
