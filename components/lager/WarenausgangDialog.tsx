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
import AddRecipientDialog from '@/components/lager/AddRecipientDialog'
import RecipientSelect, { type RecipientOption } from '@/components/lager/RecipientSelect'

type RecipientEmployee = {
  id: string
  name: string
}

interface WarenausgangDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  articles: Article[]
  onSuccess: () => void
}


function normalizeRecipientName(name: string): string {
  return name.trim().replace(/\s+/g, ' ')
}

function buildRecipientOptions(employees: RecipientEmployee[], customRecipients: string[]): RecipientOption[] {
  const options: RecipientOption[] = []
  const seenCustomNames = new Set<string>()

  const sortedEmployees = [...employees].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'de', { sensitivity: 'base' }))
  sortedEmployees.forEach((employee) => {
    const name = normalizeRecipientName(employee.name ?? '')
    if (!name) return

    options.push({
      value: `employee:${employee.id}`,
      name,
      employeeId: employee.id
    })
  })

  customRecipients
    .map((entry) => normalizeRecipientName(entry))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, 'de', { sensitivity: 'base' }))
    .forEach((name) => {
      const key = name.toLocaleLowerCase('de-DE')
      if (seenCustomNames.has(key)) return
      seenCustomNames.add(key)
      options.push({
        value: `custom:${name}`,
        name
      })
    })

  return options
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
  const [recipientEmployees, setRecipientEmployees] = useState<RecipientEmployee[]>([])
  const [customRecipients, setCustomRecipients] = useState<string[]>([])
  const [isAddRecipientDialogOpen, setIsAddRecipientDialogOpen] = useState(false)
  const [bemerkung, setBemerkung] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const selectedArticle = articles.find((a) => ((a as { _id?: unknown })._id?.toString?.() ?? a.id) === artikelId)
  const maxMenge = selectedArticle ? (selectedArticle.bestand ?? 0) : 0
  const recipientOptions = useMemo(
    () => buildRecipientOptions(recipientEmployees, customRecipients),
    [recipientEmployees, customRecipients]
  )
  const selectedRecipient = useMemo(
    () => recipientOptions.find((option) => option.value === empfaenger) ?? null,
    [recipientOptions, empfaenger]
  )

  useEffect(() => {
    if (!open) return
    let cancelled = false

    async function loadRecipientData() {
      try {
        const response = await LagerApi.recipients.list()

        if (cancelled) return
        setRecipientEmployees(
          (response.employees ?? [])
            .map((employee) => ({
              ...employee,
              id: String(employee.id ?? ''),
              name: String(employee.name ?? '').trim()
            }))
            .filter((employee) => Boolean(employee.id && employee.name))
        )
        setCustomRecipients(response.recipients ?? [])
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Empfaenger konnten nicht geladen werden')
        }
      }
    }

    loadRecipientData()

    return () => {
      cancelled = true
    }
  }, [open])

  useEffect(() => {
    if (empfaenger && !recipientOptions.some((option) => option.value === empfaenger)) {
      setEmpfaenger('')
    }
  }, [empfaenger, recipientOptions])

  const handleRecipientCreated = (nextRecipients: string[], createdName: string) => {
    setCustomRecipients(nextRecipients)

    const customValue = `custom:${createdName}`
    const addedRecipient = buildRecipientOptions(recipientEmployees, nextRecipients).find(
      (option) => option.value === customValue
    )

    if (addedRecipient) {
      setEmpfaenger(addedRecipient.value)
    }
  }

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

    const recipientName = selectedRecipient?.name ?? ''
    const recipientEmployeeId = selectedRecipient?.employeeId
    const movementRemark = recipientName
      ? `Empfaenger: ${recipientName}${bemerkung ? ` - ${bemerkung}` : ''}`
      : bemerkung

    setIsSubmitting(true)
    setError('')
    try {
      const res = await LagerApi.movements.create({
        artikelId,
        bewegungstyp: 'ausgang',
        menge,
        datum: new Date(datum).toISOString(),
        empfaenger: recipientEmployeeId,
        bemerkung: movementRemark
      })
      if ((res as { success?: boolean })?.success !== false) {
        setArtikelId('')
        setMenge(1)
        setEmpfaenger('')
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
            <Label htmlFor="wa-empfaenger">Empfaenger (optional)</Label>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <RecipientSelect
                  id="wa-empfaenger"
                  value={empfaenger}
                  onValueChange={setEmpfaenger}
                  options={recipientOptions}
                  triggerClassName="rounded-xl h-10"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-10 w-10 rounded-xl"
                onClick={() => setIsAddRecipientDialogOpen(true)}
                disabled={isSubmitting}
                aria-label="Empfaenger hinzufuegen"
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

        <AddRecipientDialog
          open={isAddRecipientDialogOpen}
          onOpenChange={setIsAddRecipientDialogOpen}
          onCreated={handleRecipientCreated}
        />
      </DialogContent>
    </Dialog>
  )
}
