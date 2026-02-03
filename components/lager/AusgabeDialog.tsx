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
import { Checkbox } from '@/components/ui/checkbox'
import type { Article } from '@/types/main'
import type { Employee } from '@/types/main'
import { LagerApi } from '@/lib/api/lager'

interface AusgabeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  articles: Article[]
  employees: Employee[]
  onSuccess: () => void
}

export default function AusgabeDialog({
  open,
  onOpenChange,
  articles,
  employees,
  onSuccess
}: AusgabeDialogProps) {
  const [artikelId, setArtikelId] = useState('')
  const [personId, setPersonId] = useState('')
  const [menge, setMenge] = useState(1)
  const [ausgabedatum, setAusgabedatum] = useState(new Date().toISOString().slice(0, 10))
  const [geplanteRueckgabe, setGeplanteRueckgabe] = useState('')
  const [bemerkung, setBemerkung] = useState('')
  const [createDeliveryNote, setCreateDeliveryNote] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const selectedArticle = articles.find((a) => ((a as any)._id?.toString?.() ?? a.id) === artikelId)
  const maxMenge = selectedArticle ? (selectedArticle.bestand ?? 0) : 0
  const activeEmployees = employees.filter((e) => (e as any).status !== 'nicht aktiv')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!artikelId || !personId) {
      setError('Bitte Artikel und Mitarbeiter wählen.')
      return
    }
    if (menge > maxMenge) {
      setError(`Bestand reicht nicht aus (max. ${maxMenge}).`)
      return
    }
    setIsSubmitting(true)
    setError('')
    try {
      const res = await LagerApi.assignments.create({
        artikelId,
        personId,
        menge,
        ausgabedatum: new Date(ausgabedatum).toISOString(),
        geplanteRueckgabe: geplanteRueckgabe ? new Date(geplanteRueckgabe).toISOString() : null,
        bemerkung: bemerkung || undefined,
        createDeliveryNote
      })
      if ((res as any)?.success !== false) {
        setArtikelId('')
        setPersonId('')
        setMenge(1)
        setGeplanteRueckgabe('')
        setBemerkung('')
        onOpenChange(false)
        onSuccess()
      } else {
        setError((res as any)?.message ?? 'Fehler bei der Ausgabe')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Fehler bei der Ausgabe')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>Artikel ausgeben</DialogTitle>
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
                {articles.map((a) => (
                  <SelectItem key={a.id ?? (a as any)._id} value={(a as any)._id?.toString?.() ?? a.id ?? ''}>
                    {a.artikelnummer} – {a.bezeichnung} (Bestand: {a.bestand ?? 0})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Mitarbeiter *</Label>
            <Select value={personId} onValueChange={setPersonId} required>
              <SelectTrigger className="rounded-xl h-10">
                <SelectValue placeholder="Mitarbeiter wählen" />
              </SelectTrigger>
              <SelectContent>
                {activeEmployees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="aus-menge">Menge *</Label>
              <Input
                id="aus-menge"
                type="number"
                min={1}
                max={maxMenge}
                value={menge}
                onChange={(e) => setMenge(parseInt(e.target.value, 10) || 1)}
                className="rounded-xl h-10"
                required
              />
              {artikelId && <p className="text-xs text-slate-500">Max.: {maxMenge}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="aus-datum">Ausgabedatum *</Label>
              <Input
                id="aus-datum"
                type="date"
                value={ausgabedatum}
                onChange={(e) => setAusgabedatum(e.target.value)}
                className="rounded-xl h-10"
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="aus-rueckgabe">Geplante Rückgabe</Label>
            <Input
              id="aus-rueckgabe"
              type="date"
              value={geplanteRueckgabe}
              onChange={(e) => setGeplanteRueckgabe(e.target.value)}
              className="rounded-xl h-10"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="aus-bemerkung">Bemerkung</Label>
            <Input
              id="aus-bemerkung"
              value={bemerkung}
              onChange={(e) => setBemerkung(e.target.value)}
              placeholder="optional"
              className="rounded-xl h-10"
            />
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="aus-lieferschein"
              checked={createDeliveryNote}
              onCheckedChange={(checked) => setCreateDeliveryNote(checked === true)}
            />
            <Label htmlFor="aus-lieferschein" className="text-sm font-normal cursor-pointer">
              Lieferschein anlegen
            </Label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Wird gespeichert…' : 'Ausgabe bestätigen'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
