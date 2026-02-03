'use client'

import React, { useState, useEffect } from 'react'
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
import { LagerApi } from '@/lib/api/lager'

interface MaintenanceItem {
  _id: string
  artikelId: { bezeichnung?: string; artikelnummer?: string }
  wartungsart: string
  faelligkeitsdatum: string
  status: string
}

interface PerformMaintenanceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  maintenanceId: string | null
  onSuccess: () => void
}

export default function PerformMaintenanceDialog({
  open,
  onOpenChange,
  maintenanceId,
  onSuccess
}: PerformMaintenanceDialogProps) {
  const [detail, setDetail] = useState<MaintenanceItem | null>(null)
  const [durchfuehrungsdatum, setDurchfuehrungsdatum] = useState(new Date().toISOString().slice(0, 10))
  const [status, setStatus] = useState<'durchgefuehrt' | 'nicht_bestanden'>('durchgefuehrt')
  const [ergebnis, setErgebnis] = useState('')
  const [naechsterTermin, setNaechsterTermin] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open || !maintenanceId) {
      setDetail(null)
      return
    }
    let cancelled = false
    LagerApi.maintenance.get(maintenanceId).then((res) => {
      const data = res as { success?: boolean; data?: MaintenanceItem }
      if (!cancelled && data?.success && data?.data) {
        setDetail(data.data)
        setDurchfuehrungsdatum(new Date().toISOString().slice(0, 10))
        setStatus('durchgefuehrt')
        setErgebnis('')
        setNaechsterTermin('')
      }
    }).catch(() => {})
    return () => {
      cancelled = true
    }
  }, [open, maintenanceId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!maintenanceId) return
    setIsSubmitting(true)
    setError('')
    try {
      const res = await LagerApi.maintenance.update(maintenanceId, {
        durchfuehrungsdatum: new Date(durchfuehrungsdatum).toISOString(),
        status,
        ergebnis: ergebnis.trim() || undefined,
        naechsterTermin: naechsterTermin ? new Date(naechsterTermin).toISOString() : null
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

  const artikelName = detail?.artikelId
    ? `${(detail.artikelId as { artikelnummer?: string }).artikelnummer ?? ''} – ${(detail.artikelId as { bezeichnung?: string }).bezeichnung ?? ''}`
    : '–'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>Wartung durchführen</DialogTitle>
        </DialogHeader>
        {detail && (
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {artikelName} · {detail.wartungsart}
            </p>
            {error && (
              <div className="rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm p-3">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="durchf-datum">Durchführungsdatum *</Label>
              <Input
                id="durchf-datum"
                type="date"
                value={durchfuehrungsdatum}
                onChange={(e) => setDurchfuehrungsdatum(e.target.value)}
                className="rounded-xl h-10"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Status *</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as 'durchgefuehrt' | 'nicht_bestanden')} required>
                <SelectTrigger className="rounded-xl h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="durchgefuehrt">Durchgeführt</SelectItem>
                  <SelectItem value="nicht_bestanden">Nicht bestanden</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="durchf-ergebnis">Ergebnis / Bemerkung</Label>
              <Input
                id="durchf-ergebnis"
                value={ergebnis}
                onChange={(e) => setErgebnis(e.target.value)}
                placeholder="optional"
                className="rounded-xl h-10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="durchf-naechster">Nächster Termin</Label>
              <Input
                id="durchf-naechster"
                type="date"
                value={naechsterTermin}
                onChange={(e) => setNaechsterTermin(e.target.value)}
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
        )}
        {!detail && open && maintenanceId && (
          <p className="text-sm text-slate-500 py-4">Lade Wartung…</p>
        )}
      </DialogContent>
    </Dialog>
  )
}
