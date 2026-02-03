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
import { Plus, Trash2 } from 'lucide-react'
import type { Article } from '@/types/main'
import type { Employee } from '@/types/main'
import { LagerApi } from '@/lib/api/lager'

interface PositionRow {
  artikelId: string
  menge: number
}

interface SammelausgabeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  articles: Article[]
  employees: Employee[]
  onSuccess: () => void
}

export default function SammelausgabeDialog({
  open,
  onOpenChange,
  articles,
  employees,
  onSuccess
}: SammelausgabeDialogProps) {
  const [positionen, setPositionen] = useState<PositionRow[]>([{ artikelId: '', menge: 1 }])
  const [personId, setPersonId] = useState('')
  const [ausgabedatum, setAusgabedatum] = useState(new Date().toISOString().slice(0, 10))
  const [geplanteRueckgabe, setGeplanteRueckgabe] = useState('')
  const [bemerkung, setBemerkung] = useState('')
  const [createDeliveryNote, setCreateDeliveryNote] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const activeArticles = articles.filter((a) => (a.status ?? 'aktiv') === 'aktiv' && (a.bestand ?? 0) > 0)
  const activeEmployees = employees.filter((e) => (e as any).status !== 'nicht aktiv')

  const addRow = () => setPositionen((prev) => [...prev, { artikelId: '', menge: 1 }])
  const removeRow = (idx: number) =>
    setPositionen((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)))
  const updateRow = (idx: number, field: 'artikelId' | 'menge', value: string | number) =>
    setPositionen((prev) => {
      const next = [...prev]
      next[idx] = { ...next[idx], [field]: value }
      return next
    })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!personId) {
      setError('Bitte Mitarbeiter wählen.')
      return
    }
    const valid = positionen.filter((p) => p.artikelId && p.menge > 0)
    if (valid.length === 0) {
      setError('Mindestens eine Position mit Artikel und Menge erforderlich.')
      return
    }
    for (const p of valid) {
      const art = activeArticles.find((a) => ((a as any)._id?.toString?.() ?? a.id) === p.artikelId)
      if (!art || (art.bestand ?? 0) < p.menge) {
        setError(`Bestand reicht nicht aus für ${art?.bezeichnung ?? p.artikelId} (max. ${art?.bestand ?? 0}).`)
        return
      }
    }
    setIsSubmitting(true)
    setError('')
    try {
      const res = await LagerApi.assignments.bulk({
        personId,
        ausgabedatum: new Date(ausgabedatum).toISOString(),
        geplanteRueckgabe: geplanteRueckgabe ? new Date(geplanteRueckgabe).toISOString() : null,
        bemerkung: bemerkung || undefined,
        createDeliveryNote,
        positionen: valid.map((p) => ({ artikelId: p.artikelId, menge: p.menge }))
      })
      if ((res as any)?.success !== false) {
        setPositionen([{ artikelId: '', menge: 1 }])
        setPersonId('')
        setGeplanteRueckgabe('')
        setBemerkung('')
        onOpenChange(false)
        onSuccess()
      } else {
        setError((res as any)?.message ?? 'Fehler bei der Sammelausgabe')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Fehler bei der Sammelausgabe')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Sammelausgabe</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {error && (
            <div className="rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm p-3">
              {error}
            </div>
          )}
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
              <Label htmlFor="sammel-datum">Ausgabedatum *</Label>
              <Input
                id="sammel-datum"
                type="date"
                value={ausgabedatum}
                onChange={(e) => setAusgabedatum(e.target.value)}
                className="rounded-xl h-10"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sammel-rueckgabe">Geplante Rückgabe</Label>
              <Input
                id="sammel-rueckgabe"
                type="date"
                value={geplanteRueckgabe}
                onChange={(e) => setGeplanteRueckgabe(e.target.value)}
                className="rounded-xl h-10"
              />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Positionen *</Label>
              <Button type="button" variant="outline" size="sm" className="gap-1" onClick={addRow}>
                <Plus className="h-3 w-3" />
                Zeile
              </Button>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-600 p-2">
              {positionen.map((row, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <Select
                    value={row.artikelId}
                    onValueChange={(v) => updateRow(idx, 'artikelId', v)}
                  >
                    <SelectTrigger className="flex-1 rounded-lg h-9 min-w-0">
                      <SelectValue placeholder="Artikel" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeArticles.map((a) => (
                        <SelectItem key={(a as any)._id ?? a.id} value={(a as any)._id?.toString?.() ?? a.id ?? ''}>
                          {a.artikelnummer} – {a.bezeichnung} (Bestand: {a.bestand ?? 0})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min={1}
                    className="w-20 rounded-lg h-9 text-right"
                    value={row.menge}
                    onChange={(e) => updateRow(idx, 'menge', parseInt(e.target.value, 10) || 0)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    onClick={() => removeRow(idx)}
                    disabled={positionen.length <= 1}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="sammel-bemerkung">Bemerkung</Label>
            <Input
              id="sammel-bemerkung"
              value={bemerkung}
              onChange={(e) => setBemerkung(e.target.value)}
              placeholder="optional"
              className="rounded-xl h-10"
            />
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="sammel-lieferschein"
              checked={createDeliveryNote}
              onCheckedChange={(checked) => setCreateDeliveryNote(checked === true)}
            />
            <Label htmlFor="sammel-lieferschein" className="text-sm font-normal cursor-pointer">
              Lieferschein anlegen
            </Label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Wird gespeichert…' : 'Sammelausgabe bestätigen'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
