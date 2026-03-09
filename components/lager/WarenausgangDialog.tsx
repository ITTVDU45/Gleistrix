'use client'

import React, { useEffect, useMemo, useState } from 'react'
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
import { Plus } from 'lucide-react'
import type { Article } from '@/types/main'
import { LagerApi } from '@/lib/api/lager'
import AddPartnerDialog from '@/components/lager/AddPartnerDialog'
import PartnerSelect, { type PartnerOption } from '@/components/lager/PartnerSelect'

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
  const [kontakt, setKontakt] = useState('')
  const [partnerEmployees, setPartnerEmployees] = useState<PartnerOption[]>([])
  const [partnerSuppliers, setPartnerSuppliers] = useState<PartnerOption[]>([])
  const [isAddPartnerDialogOpen, setIsAddPartnerDialogOpen] = useState(false)
  const [bemerkung, setBemerkung] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const selectedArticle = articles.find((a) => ((a as { _id?: unknown })._id?.toString?.() ?? a.id) === artikelId)
  const maxMenge = selectedArticle ? (selectedArticle.bestand ?? 0) : 0
  const allPartnerOptions = useMemo(
    () => [...partnerEmployees, ...partnerSuppliers],
    [partnerEmployees, partnerSuppliers]
  )
  const selectedPartner = useMemo(
    () => allPartnerOptions.find((option) => option.value === kontakt) ?? null,
    [allPartnerOptions, kontakt]
  )

  async function loadPartnerData() {
    const response = await LagerApi.partners.list()
    setPartnerEmployees(response.employees ?? [])
    setPartnerSuppliers(response.suppliers ?? [])
  }

  useEffect(() => {
    if (!open) return
    let cancelled = false

    async function loadData() {
      try {
        const response = await LagerApi.partners.list()
        if (cancelled) return
        setPartnerEmployees(response.employees ?? [])
        setPartnerSuppliers(response.suppliers ?? [])
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Kontakte konnten nicht geladen werden')
        }
      }
    }

    loadData()

    return () => {
      cancelled = true
    }
  }, [open])

  useEffect(() => {
    if (kontakt && !allPartnerOptions.some((option) => option.value === kontakt)) {
      setKontakt('')
    }
  }, [kontakt, allPartnerOptions])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!artikelId) {
      setError('Bitte Artikel waehlen.')
      return
    }
    if (menge > maxMenge) {
      setError(`Bestand reicht nicht aus (max. ${maxMenge}).`)
      return
    }

    const partnerLabel = selectedPartner?.label ?? ''
    const partnerEmployeeId = selectedPartner?.partnerType === 'employee' ? selectedPartner.employeeId : undefined
    const movementRemark = partnerLabel
      ? `Empfaenger: ${partnerLabel}${bemerkung ? ` - ${bemerkung}` : ''}`
      : bemerkung

    setIsSubmitting(true)
    setError('')
    try {
      const deliveryResponse = await LagerApi.deliveryNotes.create({
        typ: 'ausgang',
        datum: new Date(datum).toISOString(),
        empfaenger: {
          name: partnerLabel || 'Unbekannter Empfaenger',
          adresse: ''
        },
        positionen: [{
          artikelId,
          bezeichnung: selectedArticle?.bezeichnung ?? selectedArticle?.artikelnummer ?? 'Artikel',
          menge
        }]
      })
      const rawId = (deliveryResponse as { data?: { _id?: unknown; id?: string } })?.data?._id
        ?? (deliveryResponse as { data?: { _id?: string; id?: string } })?.data?.id
      const deliveryId = rawId != null ? String(rawId) : undefined

      const res = await LagerApi.movements.create({
        artikelId,
        bewegungstyp: 'ausgang',
        menge,
        datum: new Date(datum).toISOString(),
        empfaenger: partnerEmployeeId,
        lieferscheinId: deliveryId,
        bemerkung: movementRemark
      })
      if ((res as { success?: boolean })?.success !== false) {
        setArtikelId('')
        setMenge(1)
        setKontakt('')
        setBemerkung('')
        onOpenChange(false)
        onSuccess()
      } else {
        setError((res as { message?: string })?.message ?? 'Fehler beim Warenausgang')
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
                <SelectValue placeholder="Artikel waehlen" />
              </SelectTrigger>
              <SelectContent>
                {articles.filter((a) => (a.bestand ?? 0) > 0).map((a) => (
                  <SelectItem key={String((a as { _id?: unknown })._id ?? a.id ?? '')} value={(a as { _id?: unknown })._id?.toString?.() ?? a.id ?? ''}>
                    {a.artikelnummer} - {a.bezeichnung} (Bestand: {a.bestand ?? 0})
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
            <Label htmlFor="wa-kontakt">Kontakt (optional)</Label>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <PartnerSelect
                  id="wa-kontakt"
                  value={kontakt}
                  onValueChange={setKontakt}
                  employees={partnerEmployees}
                  suppliers={partnerSuppliers}
                  triggerClassName="rounded-xl h-10"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-10 w-10 rounded-xl"
                onClick={() => setIsAddPartnerDialogOpen(true)}
                disabled={isSubmitting}
                aria-label="Kontakt hinzufuegen"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
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
              {isSubmitting ? 'Wird gespeichert...' : 'Speichern'}
            </Button>
          </div>
        </form>

        <AddPartnerDialog
          open={isAddPartnerDialogOpen}
          onOpenChange={setIsAddPartnerDialogOpen}          onSaved={loadPartnerData}
        />
      </DialogContent>
    </Dialog>
  )
}



