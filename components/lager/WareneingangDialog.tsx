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
import { Plus, Trash2 } from 'lucide-react'
import type { Article } from '@/types/main'
import { LagerApi } from '@/lib/api/lager'
import AddPartnerDialog from '@/components/lager/AddPartnerDialog'
import PartnerSelect, { type PartnerOption } from '@/components/lager/PartnerSelect'
import ArticleSelect from '@/components/lager/ArticleSelect'

type OpenDeliveryNoteOption = {
  _id: string
  nummer: string
  datum?: string
  empfaenger?: { name?: string }
}

type IncomingItem = {
  id: string
  artikelId: string
  menge: number
}

interface WareneingangDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  articles: Article[]
  onSuccess: () => void
}

function formatDate(dateValue?: string): string {
  if (!dateValue) return '-'
  const parsed = new Date(dateValue)
  if (Number.isNaN(parsed.getTime())) return '-'
  return parsed.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function createIncomingItem(): IncomingItem {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    artikelId: '',
    menge: 1
  }
}

export default function WareneingangDialog({
  open,
  onOpenChange,
  articles,
  onSuccess
}: WareneingangDialogProps) {
  const [incomingItems, setIncomingItems] = useState<IncomingItem[]>([createIncomingItem()])
  const [datum, setDatum] = useState(new Date().toISOString().slice(0, 10))
  const [lieferant, setLieferant] = useState('')
  const [selectedLieferscheinId, setSelectedLieferscheinId] = useState('')
  const [manualLieferscheinNummer, setManualLieferscheinNummer] = useState('')
  const [openOutgoingDeliveryNotes, setOpenOutgoingDeliveryNotes] = useState<OpenDeliveryNoteOption[]>([])
  const [partnerEmployees, setPartnerEmployees] = useState<PartnerOption[]>([])
  const [partnerSuppliers, setPartnerSuppliers] = useState<PartnerOption[]>([])
  const [isAddPartnerDialogOpen, setIsAddPartnerDialogOpen] = useState(false)
  const [bemerkung, setBemerkung] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoadingDeliveryNotes, setIsLoadingDeliveryNotes] = useState(false)
  const [error, setError] = useState('')

  const allPartnerOptions = useMemo(
    () => [...partnerEmployees, ...partnerSuppliers],
    [partnerEmployees, partnerSuppliers]
  )
  const selectedSupplier = useMemo(
    () => allPartnerOptions.find((option) => option.value === lieferant) ?? null,
    [allPartnerOptions, lieferant]
  )
  const selectedDeliveryNote = useMemo(
    () => openOutgoingDeliveryNotes.find((note) => String(note._id) === selectedLieferscheinId) ?? null,
    [openOutgoingDeliveryNotes, selectedLieferscheinId]
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
          setError(err instanceof Error ? err.message : 'Lieferanten konnten nicht geladen werden')
        }
      }
    }

    loadData()

    return () => {
      cancelled = true
    }
  }, [open])

  useEffect(() => {
    if (lieferant && !allPartnerOptions.some((option) => option.value === lieferant)) {
      setLieferant('')
    }
  }, [lieferant, allPartnerOptions])

  useEffect(() => {
    let cancelled = false

    async function loadOpenOutgoingDeliveryNotes() {
      if (!open || !selectedSupplier?.label) {
        setOpenOutgoingDeliveryNotes([])
        setSelectedLieferscheinId('')
        setManualLieferscheinNummer('')
        return
      }

      setIsLoadingDeliveryNotes(true)
      try {
        const response = await LagerApi.deliveryNotes.listOpenOutgoing(selectedSupplier.label)
        if (cancelled) return
        const notes = (response as { deliveryNotes?: OpenDeliveryNoteOption[] })?.deliveryNotes ?? []
        setOpenOutgoingDeliveryNotes(notes)
        if (!notes.some((note) => String(note._id) === selectedLieferscheinId)) {
          setSelectedLieferscheinId('')
        }
        if (notes.length > 0) {
          setManualLieferscheinNummer('')
        }
      } catch (err) {
        if (!cancelled) {
          setOpenOutgoingDeliveryNotes([])
          setSelectedLieferscheinId('')
          setManualLieferscheinNummer('')
          setError(err instanceof Error ? err.message : 'Offene Lieferscheine konnten nicht geladen werden')
        }
      } finally {
        if (!cancelled) setIsLoadingDeliveryNotes(false)
      }
    }

    loadOpenOutgoingDeliveryNotes()
    return () => {
      cancelled = true
    }
  }, [open, selectedSupplier?.label, selectedLieferscheinId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const validItems = incomingItems.filter((item) => item.artikelId && item.menge > 0)
    if (validItems.length === 0 || validItems.length !== incomingItems.length) {
      setError('Bitte fuer jede Position Artikel und Menge > 0 angeben.')
      return
    }

    if (!selectedSupplier) {
      setError('Bitte Lieferant waehlen.')
      return
    }

    const supplierText = `Lieferant: ${selectedSupplier.label}`
    const manualDelivery = manualLieferscheinNummer.trim()
    const selectedOrManualDeliveryNumber = selectedDeliveryNote?.nummer ?? manualDelivery
    const deliveryText = selectedOrManualDeliveryNumber ? `Lieferschein: ${selectedOrManualDeliveryNumber}` : ''
    const movementRemark = [supplierText, deliveryText, bemerkung.trim()].filter(Boolean).join(' | ')

    const mergedItems = Array.from(
      validItems.reduce((map, item) => {
        map.set(item.artikelId, (map.get(item.artikelId) ?? 0) + item.menge)
        return map
      }, new Map<string, number>())
    ).map(([artikelId, mergedMenge]) => ({ artikelId, menge: mergedMenge }))

    setIsSubmitting(true)
    setError('')
    try {
      const deliveryResponse = await LagerApi.deliveryNotes.create({
        typ: 'eingang',
        datum: new Date(datum).toISOString(),
        empfaenger: {
          name: selectedSupplier.label,
          adresse: ''
        },
        positionen: mergedItems.map((item) => {
          const article = articles.find((a) => (((a as { _id?: unknown })._id?.toString?.() ?? a.id) === item.artikelId))
          return {
            artikelId: item.artikelId,
            bezeichnung: article?.bezeichnung ?? article?.artikelnummer ?? 'Artikel',
            menge: item.menge
          }
        })
      })
      const rawId = (deliveryResponse as { data?: { _id?: unknown; id?: string } })?.data?._id
        ?? (deliveryResponse as { data?: { _id?: string; id?: string } })?.data?.id
      const generatedDeliveryId = rawId != null ? String(rawId) : undefined

      for (const item of mergedItems) {
        const res = await LagerApi.movements.create({
          artikelId: item.artikelId,
          bewegungstyp: 'eingang',
          menge: item.menge,
          datum: new Date(datum).toISOString(),
          lieferscheinId: generatedDeliveryId || selectedLieferscheinId || undefined,
          bemerkung: movementRemark
        })
        if ((res as { success?: boolean })?.success === false) {
          throw new Error((res as { message?: string })?.message ?? 'Fehler beim Wareneingang')
        }
      }

      setIncomingItems([createIncomingItem()])
      setLieferant('')
      setSelectedLieferscheinId('')
      setManualLieferscheinNummer('')
      setOpenOutgoingDeliveryNotes([])
      setBemerkung('')
      onOpenChange(false)
      onSuccess()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Fehler beim Wareneingang')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>Wareneingang erfassen</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {error && (
            <div className="rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm p-3">
              {error}
            </div>
          )}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Positionen *</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-lg"
                onClick={() => setIncomingItems((prev) => [...prev, createIncomingItem()])}
                disabled={isSubmitting}
              >
                <Plus className="mr-1 h-4 w-4" />
                Position
              </Button>
            </div>
            {incomingItems.map((item, index) => (
              <div key={item.id} className="grid grid-cols-[1fr_110px_42px] gap-2">
                <ArticleSelect
                  id={`we-artikel-${index + 1}`}
                  value={item.artikelId}
                  onValueChange={(value) => {
                    setIncomingItems((prev) =>
                      prev.map((entry) => (entry.id === item.id ? { ...entry, artikelId: value } : entry))
                    )
                  }}
                  articles={articles}
                  placeholder={`Artikel ${index + 1} waehlen`}
                  searchPlaceholder="Artikel suchen..."
                  triggerClassName="rounded-xl h-10"
                  disabled={isSubmitting}
                />
                <Input
                  type="number"
                  min={1}
                  value={item.menge}
                  onChange={(e) => {
                    const nextMenge = parseInt(e.target.value, 10) || 1
                    setIncomingItems((prev) =>
                      prev.map((entry) => (entry.id === item.id ? { ...entry, menge: nextMenge } : entry))
                    )
                  }}
                  className="rounded-xl h-10"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 rounded-xl"
                  disabled={incomingItems.length <= 1 || isSubmitting}
                  onClick={() => setIncomingItems((prev) => prev.filter((entry) => entry.id !== item.id))}
                  aria-label={`Position ${index + 1} entfernen`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <Label htmlFor="we-datum">Datum *</Label>
            <Input
              id="we-datum"
              type="date"
              value={datum}
              onChange={(e) => setDatum(e.target.value)}
              className="rounded-xl h-10"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="we-lieferant">Lieferant *</Label>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <PartnerSelect
                  id="we-lieferant"
                  value={lieferant}
                  onValueChange={setLieferant}
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
                aria-label="Lieferant hinzufuegen"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Lieferscheinnummer (optional)</Label>
            <Select
              value={selectedLieferscheinId || '__none'}
              onValueChange={(value) => setSelectedLieferscheinId(value === '__none' ? '' : value)}
              disabled={!selectedSupplier || isLoadingDeliveryNotes}
            >
              <SelectTrigger className="rounded-xl h-10">
                <SelectValue
                  placeholder={
                    !selectedSupplier
                      ? 'Zuerst Lieferant/Mitarbeiter waehlen'
                      : isLoadingDeliveryNotes
                        ? 'Lade offene Lieferscheine...'
                        : 'Offenen Lieferschein auswaehlen'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">Kein Lieferschein</SelectItem>
                {openOutgoingDeliveryNotes.map((note) => (
                  <SelectItem key={String(note._id)} value={String(note._id)}>
                    {note.nummer} - {formatDate(note.datum)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedSupplier && !isLoadingDeliveryNotes && openOutgoingDeliveryNotes.length === 0 && (
              <Input
                value={manualLieferscheinNummer}
                onChange={(e) => setManualLieferscheinNummer(e.target.value)}
                placeholder="Manuelle Lieferscheinnummer eingeben"
                className="rounded-xl h-10 mt-2"
              />
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="we-bemerkung">Bemerkung</Label>
            <Input
              id="we-bemerkung"
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
          onOpenChange={setIsAddPartnerDialogOpen}
          onSaved={loadPartnerData}
        />
      </DialogContent>
    </Dialog>
  )
}

