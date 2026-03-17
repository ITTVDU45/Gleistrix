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
import { Plus, Check } from 'lucide-react'
import type { Article, ArticleUnit } from '@/types/main'
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
  const [availableUnits, setAvailableUnits] = useState<ArticleUnit[]>([])
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([])
  const [loadingUnits, setLoadingUnits] = useState(false)

  const selectedArticle = articles.find((a) => ((a as { _id?: unknown })._id?.toString?.() ?? a.id) === artikelId)
  const isIndividualTracking = selectedArticle?.serialTracking === 'individual'
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

  useEffect(() => {
    if (!artikelId || !isIndividualTracking) {
      setAvailableUnits([])
      setSelectedUnitIds([])
      return
    }
    let cancelled = false
    setLoadingUnits(true)
    LagerApi.units.list(artikelId, { status: 'verfuegbar' })
      .then(res => { if (!cancelled) setAvailableUnits(res.units ?? []) })
      .catch(() => { if (!cancelled) setAvailableUnits([]) })
      .finally(() => { if (!cancelled) setLoadingUnits(false) })
    return () => { cancelled = true }
  }, [artikelId, isIndividualTracking])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!artikelId) {
      setError('Bitte Artikel waehlen.')
      return
    }
    if (isIndividualTracking && selectedUnitIds.length === 0) {
      setError('Bitte mindestens eine Unit auswählen.')
      return
    }
    const effectiveMenge = isIndividualTracking ? selectedUnitIds.length : menge
    if (effectiveMenge > maxMenge) {
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
      const positionen = isIndividualTracking
        ? selectedUnitIds.map(uid => {
            const unit = availableUnits.find(u => (u.id ?? u._id) === uid)
            return {
              artikelId,
              bezeichnung: selectedArticle?.bezeichnung ?? selectedArticle?.artikelnummer ?? 'Artikel',
              menge: 1,
              seriennummer: unit?.seriennummer ?? ''
            }
          })
        : [{
            artikelId,
            bezeichnung: selectedArticle?.bezeichnung ?? selectedArticle?.artikelnummer ?? 'Artikel',
            menge: effectiveMenge
          }]

      const deliveryResponse = await LagerApi.deliveryNotes.create({
        typ: 'ausgang',
        datum: new Date(datum).toISOString(),
        empfaenger: {
          name: partnerLabel || 'Unbekannter Empfaenger',
          adresse: ''
        },
        positionen
      })
      const rawId = (deliveryResponse as { data?: { _id?: unknown; id?: string } })?.data?._id
        ?? (deliveryResponse as { data?: { _id?: string; id?: string } })?.data?.id
      const deliveryId = rawId != null ? String(rawId) : undefined

      const res = await LagerApi.movements.create({
        artikelId,
        bewegungstyp: 'ausgang',
        menge: effectiveMenge,
        datum: new Date(datum).toISOString(),
        empfaenger: partnerEmployeeId,
        lieferscheinId: deliveryId,
        bemerkung: movementRemark,
        unitIds: isIndividualTracking ? selectedUnitIds : undefined
      })
      if ((res as { success?: boolean })?.success !== false) {
        setArtikelId('')
        setMenge(1)
        setKontakt('')
        setBemerkung('')
        setSelectedUnitIds([])
        setAvailableUnits([])
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
          {isIndividualTracking && artikelId && (
            <div className="space-y-2">
              <Label>Units auswählen * {selectedUnitIds.length > 0 && `(${selectedUnitIds.length} gewählt)`}</Label>
              {loadingUnits ? (
                <p className="text-xs text-slate-500">Lade Units...</p>
              ) : availableUnits.length === 0 ? (
                <p className="text-xs text-slate-500">Keine verfügbaren Units</p>
              ) : (
                <div className="max-h-40 overflow-y-auto space-y-1 rounded-xl border border-slate-200 dark:border-slate-700 p-2">
                  {availableUnits.map(unit => {
                    const uid = unit.id ?? unit._id ?? ''
                    const isSelected = selectedUnitIds.includes(uid)
                    return (
                      <button
                        key={uid}
                        type="button"
                        className={`flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-lg text-sm transition-colors ${isSelected ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                        onClick={() => {
                          setSelectedUnitIds(prev =>
                            isSelected ? prev.filter(id => id !== uid) : [...prev, uid]
                          )
                        }}
                      >
                        <div className={`h-4 w-4 rounded border flex items-center justify-center ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-slate-300 dark:border-slate-600'}`}>
                          {isSelected && <Check className="h-3 w-3 text-white" />}
                        </div>
                        <span className="font-mono text-xs">{unit.seriennummer}</span>
                        <span className="text-xs text-slate-400 ml-auto">{unit.barcode ?? ''}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="wa-menge">Menge *</Label>
              <Input
                id="wa-menge"
                type="number"
                min={1}
                max={maxMenge}
                value={isIndividualTracking ? selectedUnitIds.length : menge}
                onChange={(e) => setMenge(parseInt(e.target.value, 10) || 1)}
                className="rounded-xl h-10"
                required
                readOnly={isIndividualTracking}
              />
              {artikelId && <p className="text-xs text-slate-500">
                {isIndividualTracking ? `${selectedUnitIds.length} Unit(s) gewählt` : `Max. Bestand: ${maxMenge}`}
              </p>}
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



