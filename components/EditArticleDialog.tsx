'use client'

import React, { useState, useEffect } from 'react'
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

export default function EditArticleDialog({
  article,
  categories,
  open,
  onOpenChange,
  onSuccess
}: EditArticleDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
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

  useEffect(() => {
    if (open && article) {
      setForm({
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
      })
    }
  }, [open, article])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const id = article.id ?? (article as any)._id?.toString?.()
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
        typ: form.typ ?? 'Werkzeug',
        bestand: form.bestand ?? 0,
        mindestbestand: form.mindestbestand ?? 0,
        zustand: form.zustand ?? 'gut',
        status: form.status ?? 'aktiv'
      })
      if ((res as any)?.success !== false) {
        onOpenChange(false)
        onSuccess()
      } else {
        setError((res as any)?.message ?? 'Fehler beim Speichern')
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
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Kategorie *</Label>
            <Select
              value={form.kategorie ?? ''}
              onValueChange={(v) => update('kategorie', v)}
              required
            >
              <SelectTrigger className="rounded-xl h-10">
                <SelectValue placeholder="Kategorie wählen" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id ?? (c as any)._id ?? c.name} value={c.name}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
            <p className="text-xs text-slate-500 dark:text-slate-400">Schwellwert für Warnung „Unter Mindestbestand“</p>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Wird gespeichert…' : 'Speichern'}
          </Button>
        </div>
      </form>
    </DialogContent>
    </Dialog>
  )
}
