'use client'

import { useMemo, useState } from 'react'
import { Loader2, Plus, X, Users, Video } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { PlantafelApi } from '@/lib/api/plantafel'
import type { Employee } from '../../types'

interface MeetingDialogProps {
  open: boolean
  onClose: () => void
  onCreated: () => void
  employees: Employee[]
  /** Vorbelegtes Datum (yyyy-MM-dd) für Start/Ende. */
  defaultDate: string
}

interface Attendee {
  employeeId?: string | null
  name?: string
  email: string
}

function isEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
}

export default function MeetingDialog({ open, onClose, onCreated, employees, defaultDate }: MeetingDialogProps) {
  const [titel, setTitel] = useState('')
  const [von, setVon] = useState(`${defaultDate}T09:00`)
  const [bis, setBis] = useState(`${defaultDate}T10:00`)
  const [notizen, setNotizen] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [externals, setExternals] = useState<string[]>([])
  const [externalInput, setExternalInput] = useState('')
  const [search, setSearch] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  const filteredEmployees = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = q ? employees.filter((e) => e.name.toLowerCase().includes(q)) : employees
    return [...list].sort((a, b) => a.name.localeCompare(b.name))
  }, [employees, search])

  const toggleEmployee = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const addExternal = () => {
    const v = externalInput.trim()
    if (!isEmail(v)) return
    if (!externals.includes(v)) setExternals((p) => [...p, v])
    setExternalInput('')
  }

  const removeExternal = (email: string) => setExternals((p) => p.filter((e) => e !== email))

  const handleSubmit = async () => {
    setError('')
    if (!titel.trim()) return setError('Bitte einen Titel eingeben.')
    if (!von || !bis) return setError('Bitte Start und Ende angeben.')
    if (new Date(bis) <= new Date(von)) return setError('Das Ende muss nach dem Start liegen.')

    const employeeAttendees: Attendee[] = employees
      .filter((e) => selectedIds.has(e.id))
      .map((e) => ({ employeeId: e.id, name: e.name, email: (e.email || '').trim() }))
      .filter((a) => isEmail(a.email))

    const missingEmail = employees.filter((e) => selectedIds.has(e.id) && !isEmail((e.email || '').trim()))
    const externalAttendees: Attendee[] = externals.map((email) => ({ employeeId: null, name: '', email }))
    const attendees = [...employeeAttendees, ...externalAttendees]

    setIsSaving(true)
    try {
      const res = await PlantafelApi.createMeeting({
        titel: titel.trim(),
        von: new Date(von).toISOString(),
        bis: new Date(bis).toISOString(),
        notizen: notizen.trim(),
        attendees,
      })
      if (!res.success) {
        setError('Meeting konnte nicht angelegt werden.')
        return
      }
      if (missingEmail.length > 0) {
        // Kein harter Fehler – Meeting ist angelegt, nur ohne diese Teilnehmer.
        console.warn('Mitarbeiter ohne E-Mail übersprungen:', missingEmail.map((e) => e.name))
      }
      onCreated()
      onClose()
    } catch {
      setError('Netzwerkfehler beim Anlegen des Meetings.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Video className="h-5 w-5 text-[#4b53bc]" /> Meeting planen
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Titel</Label>
            <Input value={titel} onChange={(e) => setTitel(e.target.value)} placeholder="z. B. Baustellenbesprechung" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Von</Label>
              <Input type="datetime-local" value={von} onChange={(e) => setVon(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Bis</Label>
              <Input type="datetime-local" value={bis} onChange={(e) => setBis(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5"><Users className="h-4 w-4" /> Teilnehmer (Mitarbeiter)</Label>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Mitarbeiter suchen…" />
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-slate-200 p-2 dark:border-slate-700">
              {filteredEmployees.length === 0 ? (
                <p className="text-xs text-slate-400">Keine Mitarbeiter gefunden.</p>
              ) : (
                filteredEmployees.map((e) => {
                  const hasEmail = isEmail((e.email || '').trim())
                  return (
                    <label key={e.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={selectedIds.has(e.id)}
                        disabled={!hasEmail}
                        onCheckedChange={() => toggleEmployee(e.id)}
                      />
                      <span className={hasEmail ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400'}>
                        {e.name}{!hasEmail && ' (keine E-Mail)'}
                      </span>
                    </label>
                  )
                })
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Externe Teilnehmer (E-Mail)</Label>
            <div className="flex gap-2">
              <Input
                value={externalInput}
                onChange={(e) => setExternalInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addExternal() } }}
                placeholder="name@firma.de"
              />
              <Button type="button" variant="outline" size="sm" onClick={addExternal} disabled={!isEmail(externalInput)}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {externals.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {externals.map((email) => (
                  <span key={email} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs dark:bg-slate-700">
                    {email}
                    <button type="button" onClick={() => removeExternal(email)} className="text-slate-400 hover:text-red-500">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Notizen</Label>
            <Textarea value={notizen} onChange={(e) => setNotizen(e.target.value)} rows={2} placeholder="Optional" />
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={onClose} disabled={isSaving}>Abbrechen</Button>
            <Button onClick={handleSubmit} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Video className="h-4 w-4 mr-1" />}
              Meeting anlegen
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
