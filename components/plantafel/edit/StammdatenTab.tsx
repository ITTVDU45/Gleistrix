'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Save, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { ProjectsApi } from '@/lib/api/projects'
import type { Project } from '../../../types'

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'aktiv', label: 'Aktiv' },
  { value: 'abgeschlossen', label: 'Abgeschlossen' },
  { value: 'fertiggestellt', label: 'Fertiggestellt' },
  { value: 'geleistet', label: 'Geleistet' },
  { value: 'teilweise_abgerechnet', label: 'Teilweise abgerechnet' },
  { value: 'kein Status', label: 'Kein Status' },
]

interface StammdatenTabProps {
  project: Project
  onSaved: () => void
}

interface Form {
  status: string
  auftraggeber: string
  baustelle: string
  auftragsnummer: string
  sapNummer: string
  telefonnummer: string
  atwsImEinsatz: boolean
  anzahlAtws: number
}

export default function StammdatenTab({ project, onSaved }: StammdatenTabProps) {
  const [form, setForm] = useState<Form>({
    status: project.status || 'aktiv',
    auftraggeber: project.auftraggeber || '',
    baustelle: project.baustelle || '',
    auftragsnummer: project.auftragsnummer || '',
    sapNummer: project.sapNummer || '',
    telefonnummer: project.telefonnummer || '',
    atwsImEinsatz: Boolean(project.atwsImEinsatz),
    anzahlAtws: Number(project.anzahlAtws) || 0,
  })
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const update = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setSuccess(false)
  }

  const handleSave = async () => {
    if (
      !form.auftraggeber.trim() ||
      !form.baustelle.trim() ||
      !form.auftragsnummer.trim() ||
      !form.sapNummer.trim() ||
      !form.telefonnummer.trim() ||
      (form.atwsImEinsatz && form.anzahlAtws < 1)
    ) {
      setError('Bitte alle Felder korrekt ausfüllen (bei ATWS mindestens Anzahl 1).')
      return
    }
    setIsSaving(true)
    setError(null)
    try {
      await ProjectsApi.update(project.id, {
        status: form.status,
        auftraggeber: form.auftraggeber,
        baustelle: form.baustelle,
        auftragsnummer: form.auftragsnummer,
        sapNummer: form.sapNummer,
        telefonnummer: form.telefonnummer,
        atwsImEinsatz: form.atwsImEinsatz,
        anzahlAtws: form.atwsImEinsatz ? form.anzahlAtws : 0,
      } as Parameters<typeof ProjectsApi.update>[1])
      setSuccess(true)
      onSaved()
    } catch {
      setError('Speichern fehlgeschlagen. Bitte erneut versuchen.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select value={form.status} onValueChange={(v) => update('status', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Auftraggeber</Label>
          <Input value={form.auftraggeber} onChange={(e) => update('auftraggeber', e.target.value)} />
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <Label>Baustelle</Label>
          <Input value={form.baustelle} onChange={(e) => update('baustelle', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Auftragsnummer</Label>
          <Input value={form.auftragsnummer} onChange={(e) => update('auftragsnummer', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>SAP-Nummer</Label>
          <Input value={form.sapNummer} onChange={(e) => update('sapNummer', e.target.value)} />
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <Label>Telefon / Ansprechpartner</Label>
          <Input value={form.telefonnummer} onChange={(e) => update('telefonnummer', e.target.value)} />
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 p-3">
        <div>
          <p className="text-sm font-medium text-slate-900 dark:text-white">ATWS im Einsatz</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Hinweis: Bei Material-Änderungen wird die ATWS-Anzahl automatisch neu berechnet.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {form.atwsImEinsatz && (
            <Input
              type="number"
              min={1}
              className="w-20 h-8"
              value={form.anzahlAtws}
              onChange={(e) => update('anzahlAtws', Number(e.target.value) || 0)}
            />
          )}
          <Switch checked={form.atwsImEinsatz} onCheckedChange={(v) => update('atwsImEinsatz', v)} />
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3">
          <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      <div className="flex items-center justify-end gap-3">
        {success && (
          <span className="flex items-center gap-1 text-sm text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4" /> Gespeichert
          </span>
        )}
        <Button onClick={handleSave} disabled={isSaving} className="bg-blue-600 hover:bg-blue-700 text-white">
          {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Stammdaten speichern
        </Button>
      </div>
    </div>
  )
}
