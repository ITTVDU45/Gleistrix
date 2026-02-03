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
import type { Article } from '@/types/main'
import { LagerApi } from '@/lib/api/lager'

interface AddMaintenanceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  articles: Article[]
  onSuccess: () => void
}

const WARTUNGSARTEN = ['TÜV', 'Service', 'Prüfung', 'Kalibrierung', 'Inspektion', 'Sonstige']

export default function AddMaintenanceDialog({
  open,
  onOpenChange,
  articles,
  onSuccess
}: AddMaintenanceDialogProps) {
  const [artikelId, setArtikelId] = useState('')
  const [wartungsart, setWartungsart] = useState('')
  const [faelligkeitsdatum, setFaelligkeitsdatum] = useState(new Date().toISOString().slice(0, 10))
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const activeArticles = articles.filter((a) => (a.status ?? 'aktiv') === 'aktiv')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!artikelId || !wartungsart.trim()) {
      setError('Bitte Artikel und Wartungsart angeben.')
      return
    }
    setIsSubmitting(true)
    setError('')
    try {
      const res = await LagerApi.maintenance.create({
        artikelId,
        wartungsart: wartungsart.trim(),
        faelligkeitsdatum: new Date(faelligkeitsdatum).toISOString(),
        status: 'geplant'
      })
      if ((res as any)?.success !== false) {
        setArtikelId('')
        setWartungsart('')
        setFaelligkeitsdatum(new Date().toISOString().slice(0, 10))
        onOpenChange(false)
        onSuccess()
      } else {
        setError((res as any)?.message ?? 'Fehler beim Anlegen der Wartung')
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
            <Label>Artikel *</Label>
            <Select value={artikelId} onValueChange={setArtikelId} required>
              <SelectTrigger className="rounded-xl h-10">
                <SelectValue placeholder="Artikel wählen" />
              </SelectTrigger>
              <SelectContent>
                {activeArticles.map((a) => (
                  <SelectItem key={a.id ?? (a as any)._id} value={(a as any)._id?.toString?.() ?? a.id ?? ''}>
                    {a.artikelnummer} – {a.bezeichnung}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
