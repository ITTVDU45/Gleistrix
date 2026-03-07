'use client'

import React, { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import type { Article, Category } from '@/types/main'
import { LagerApi } from '@/lib/api/lager'

function getCategoryId(c: Category): string {
  return (c as { _id?: string })._id ?? (c as { id?: string }).id ?? ''
}

interface AddMaintenanceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  articles: Article[]
  categories: Category[]
  onSuccess: () => void
}

const WARTUNGSARTEN = ['TÜV', 'Service', 'Prüfung', 'Kalibrierung', 'Inspektion', 'Sonstige']

type ScopeMode = 'article' | 'category'

export default function AddMaintenanceDialog({
  open,
  onOpenChange,
  articles,
  categories,
  onSuccess
}: AddMaintenanceDialogProps) {
  const [mode, setMode] = useState<ScopeMode>('article')
  const [artikelId, setArtikelId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [wartungsart, setWartungsart] = useState('')
  const [faelligkeitsdatum, setFaelligkeitsdatum] = useState(new Date().toISOString().slice(0, 10))
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const activeArticles = articles.filter((a) => (a.status ?? 'aktiv') === 'aktiv')
  const activeCategories = categories.filter((c) => getCategoryId(c))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!wartungsart.trim()) {
      setError('Bitte Wartungsart angeben.')
      return
    }
    if (mode === 'article') {
      if (!artikelId) {
        setError('Bitte einen Artikel wählen.')
        return
      }
    } else {
      if (!categoryId) {
        setError('Bitte eine Kategorie wählen.')
        return
      }
    }
    setIsSubmitting(true)
    setError('')
    try {
      const payload: {
        artikelId?: string
        categoryId?: string
        wartungsart: string
        faelligkeitsdatum: string
        status: string
      } = {
        wartungsart: wartungsart.trim(),
        faelligkeitsdatum: new Date(faelligkeitsdatum).toISOString(),
        status: 'geplant'
      }
      if (mode === 'article') payload.artikelId = artikelId
      else payload.categoryId = categoryId

      const res = await LagerApi.maintenance.create(payload)
      if ((res as { success?: boolean })?.success !== false) {
        const created = (res as { created?: number }).created ?? 1
        setArtikelId('')
        setCategoryId('')
        setWartungsart('')
        setFaelligkeitsdatum(new Date().toISOString().slice(0, 10))
        onOpenChange(false)
        onSuccess()
      } else {
        setError((res as { message?: string })?.message ?? 'Fehler beim Anlegen der Wartung')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Fehler beim Anlegen der Wartung')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>Wartung anlegen</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {error && (
            <div className="rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm p-3">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label>Umfang</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={mode === 'article' ? 'default' : 'outline'}
                size="sm"
                className="rounded-xl"
                onClick={() => { setMode('article'); setCategoryId(''); setError('') }}
              >
                Einzelner Artikel
              </Button>
              <Button
                type="button"
                variant={mode === 'category' ? 'default' : 'outline'}
                size="sm"
                className="rounded-xl"
                onClick={() => { setMode('category'); setArtikelId(''); setError('') }}
              >
                Gesamte Kategorie
              </Button>
            </div>
          </div>
          {mode === 'article' ? (
            <div className="space-y-2">
              <Label>Artikel *</Label>
              <Select value={artikelId} onValueChange={setArtikelId} required={mode === 'article'}>
                <SelectTrigger className="rounded-xl h-10">
                  <SelectValue placeholder="Artikel wählen" />
                </SelectTrigger>
                <SelectContent>
                  {activeArticles.map((a) => (
                    <SelectItem key={a.id ?? (a as { _id?: string })._id} value={(a as { _id?: string })._id?.toString?.() ?? (a as { id?: string }).id ?? ''}>
                      {a.artikelnummer} – {a.bezeichnung}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Kategorie *</Label>
              <Select value={categoryId} onValueChange={setCategoryId} required={mode === 'category'}>
                <SelectTrigger className="rounded-xl h-10">
                  <SelectValue placeholder="Kategorie wählen" />
                </SelectTrigger>
                <SelectContent>
                  {activeCategories.map((c) => (
                    <SelectItem key={getCategoryId(c)} value={getCategoryId(c)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Für alle aktiven Artikel dieser Kategorie wird eine Wartung mit gleichem Fälligkeitsdatum angelegt.
              </p>
            </div>
          )}
          <div className="space-y-2">
            <Label>Wartungsart *</Label>
            <Select value={wartungsart} onValueChange={setWartungsart} required>
              <SelectTrigger className="rounded-xl h-10">
                <SelectValue placeholder="Wartungsart wählen" />
              </SelectTrigger>
              <SelectContent>
                {WARTUNGSARTEN.map((w) => (
                  <SelectItem key={w} value={w}>
                    {w}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="wartung-faellig">Fälligkeitsdatum *</Label>
            <Input
              id="wartung-faellig"
              type="date"
              value={faelligkeitsdatum}
              onChange={(e) => setFaelligkeitsdatum(e.target.value)}
              className="rounded-xl h-10"
              required
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Wird gespeichert…' : 'Anlegen'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
