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

interface WarenausgangDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  articles: Article[]
  onSuccess: () => void
}

export default function WarenausgangDialog({
  open,
  onOpenChange,
  articles,
  onSuccess
}: WarenausgangDialogProps) {
  const [artikelId, setArtikelId] = useState('')
  const [menge, setMenge] = useState(1)
  const [datum, setDatum] = useState(new Date().toISOString().slice(0, 10))
  const [empfaenger, setEmpfaenger] = useState('')
  const [bemerkung, setBemerkung] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const selectedArticle = articles.find((a) => ((a as any)._id?.toString?.() ?? a.id) === artikelId)
  const maxMenge = selectedArticle ? (selectedArticle.bestand ?? 0) : 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!artikelId) {
      setError('Bitte Artikel wählen.')
      return
    }
    if (menge > maxMenge) {
      setError(`Bestand reicht nicht aus (max. ${maxMenge}).`)
      return
    }
    setIsSubmitting(true)
    setError('')
    try {
      const res = await LagerApi.movements.create({
        artikelId,
        bewegungstyp: 'ausgang',
        menge,
        datum: new Date(datum).toISOString(),
        bemerkung: empfaenger ? `Empfänger: ${empfaenger}${bemerkung ? ` – ${bemerkung}` : ''}` : bemerkung
      })
      if ((res as any)?.success !== false) {
        setArtikelId('')
        setMenge(1)
        setEmpfaenger('')
        setBemerkung('')
        onOpenChange(false)
        onSuccess()
      } else {
        setError((res as any)?.message ?? 'Fehler beim Warenausgang')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Fehler beim Warenausgang')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>Warenausgang erfassen</DialogTitle>
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
                {articles.filter((a) => (a.bestand ?? 0) > 0).map((a) => (
                  <SelectItem key={a.id ?? (a as any)._id} value={(a as any)._id?.toString?.() ?? a.id ?? ''}>
                    {a.artikelnummer} – {a.bezeichnung} (Bestand: {a.bestand ?? 0})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="wa-menge">Menge *</Label>
              <Input
                id="wa-menge"
                type="number"
                min={1}
                max={maxMenge}
                value={menge}
                onChange={(e) => setMenge(parseInt(e.target.value, 10) || 1)}
                className="rounded-xl h-10"
                required
              />
              {artikelId && <p className="text-xs text-slate-500">Max. Bestand: {maxMenge}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="wa-datum">Datum *</Label>
              <Input
                id="wa-datum"
                type="date"
                value={datum}
                onChange={(e) => setDatum(e.target.value)}
                className="rounded-xl h-10"
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="wa-empfaenger">Empfänger / Grund</Label>
            <Input
              id="wa-empfaenger"
              value={empfaenger}
              onChange={(e) => setEmpfaenger(e.target.value)}
              placeholder="optional"
              className="rounded-xl h-10"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wa-bemerkung">Bemerkung</Label>
            <Input
              id="wa-bemerkung"
              value={bemerkung}
              onChange={(e) => setBemerkung(e.target.value)}
              placeholder="optional"
              className="rounded-xl h-10"
            />
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
