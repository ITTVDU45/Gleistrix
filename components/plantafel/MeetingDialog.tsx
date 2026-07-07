'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, Plus, X, Users, Video, Trash2, CheckCircle2, AlertTriangle, Copy, ExternalLink } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { PlantafelApi, type MeetingSyncResult } from '@/lib/api/plantafel'
import type { Employee } from '../../types'

interface MeetingDialogProps {
  open: boolean
  onClose: () => void
  onCreated: () => void
  employees: Employee[]
  /** Vorbelegtes Datum (yyyy-MM-dd) für Start/Ende (Neuanlage). */
  defaultDate: string
  /** Wenn gesetzt: Bearbeiten eines bestehenden Meetings. */
  meetingId?: string | null
}

interface Attendee {
  employeeId?: string | null
  name?: string
  email: string
}

function isEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
}

/** UTC-ISO → lokaler datetime-local-Wert (yyyy-MM-ddTHH:mm). */
function toLocalInput(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function MeetingDialog({ open, onClose, onCreated, employees, defaultDate, meetingId }: MeetingDialogProps) {
  const isEdit = Boolean(meetingId)

  const [titel, setTitel] = useState('')
  const [von, setVon] = useState(`${defaultDate}T09:00`)
  const [bis, setBis] = useState(`${defaultDate}T10:00`)
  const [notizen, setNotizen] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [externals, setExternals] = useState<string[]>([])
  const [externalInput, setExternalInput] = useState('')
  const [search, setSearch] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmNoAttendees, setConfirmNoAttendees] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{
    sync?: MeetingSyncResult
    titel: string
    von: string
    bis: string
    attendees: Attendee[]
  } | null>(null)
  const [copied, setCopied] = useState('')

  // Bearbeiten: bestehendes Meeting laden und Felder vorbelegen
  useEffect(() => {
    if (!open || !meetingId) return
    let active = true
    setIsLoading(true)
    PlantafelApi.getMeeting(meetingId)
      .then((res) => {
        if (!active || !res.success || !res.data) return
        const m = res.data
        setTitel(m.titel || '')
        setVon(toLocalInput(m.von))
        setBis(toLocalInput(m.bis))
        setNotizen(m.notizen || '')
        const atts = m.attendees || []
        setSelectedIds(new Set(atts.filter((a) => a.employeeId).map((a) => String(a.employeeId))))
        setExternals(atts.filter((a) => !a.employeeId).map((a) => a.email))
      })
      .catch(() => setError('Meeting konnte nicht geladen werden.'))
      .finally(() => { if (active) setIsLoading(false) })
    return () => { active = false }
  }, [open, meetingId])

  const filteredEmployees = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = q ? employees.filter((e) => e.name.toLowerCase().includes(q)) : employees
    return [...list].sort((a, b) => a.name.localeCompare(b.name))
  }, [employees, search])

  // Wie viele Teilnehmer bekommen tatsächlich eine Einladung (gültige E-Mail)?
  const invitableCount = useMemo(() => {
    const emps = employees.filter((e) => selectedIds.has(e.id) && isEmail((e.email || '').trim())).length
    const pending = externalInput.trim()
    const pendingCount = isEmail(pending) && !externals.includes(pending) ? 1 : 0
    return emps + externals.length + pendingCount
  }, [employees, selectedIds, externals, externalInput])

  // Sobald Teilnehmer vorhanden sind, den Ohne-Teilnehmer-Hinweis zurücksetzen.
  useEffect(() => {
    if (invitableCount > 0) {
      setConfirmNoAttendees(false)
      setError((e) => (e.startsWith('Kein Teilnehmer') ? '' : e))
    }
  }, [invitableCount])

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

    // Noch nicht per „+"/Enter übernommene, aber gültige E-Mail mit aufnehmen.
    const pending = externalInput.trim()
    const allExternals = isEmail(pending) && !externals.includes(pending) ? [...externals, pending] : externals

    const externalAttendees: Attendee[] = allExternals.map((email) => ({ employeeId: null, name: '', email }))
    const attendees = [...employeeAttendees, ...externalAttendees]

    // Ohne Teilnehmer würde keine Einladung versendet – einmal nachfragen.
    if (attendees.length === 0 && !confirmNoAttendees) {
      setConfirmNoAttendees(true)
      setError('Kein Teilnehmer mit E-Mail ausgewählt – es wird keine Einladung versendet. Zum Fortfahren erneut auf „Meeting anlegen" klicken.')
      return
    }

    const payload = {
      titel: titel.trim(),
      von: new Date(von).toISOString(),
      bis: new Date(bis).toISOString(),
      notizen: notizen.trim(),
      attendees,
    }

    setIsSaving(true)
    try {
      const res = isEdit
        ? await PlantafelApi.updateMeeting(meetingId!, payload)
        : await PlantafelApi.createMeeting(payload)
      if (!res.success) {
        setError('Meeting konnte nicht gespeichert werden.')
        return
      }
      onCreated() // Board im Hintergrund aktualisieren
      setResult({ sync: res.data?.sync, titel: payload.titel, von: payload.von, bis: payload.bis, attendees })
    } catch {
      setError('Netzwerkfehler beim Speichern des Meetings.')
    } finally {
      setIsSaving(false)
    }
  }

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      setTimeout(() => setCopied(''), 1500)
    } catch {
      /* Clipboard evtl. blockiert */
    }
  }

  function fmt(iso: string): string {
    const d = new Date(iso)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  const handleDelete = async () => {
    if (!meetingId) return
    if (!confirmDelete) { setConfirmDelete(true); return }
    setIsSaving(true)
    try {
      await PlantafelApi.deleteMeeting(meetingId)
      onCreated()
      onClose()
    } catch {
      setError('Netzwerkfehler beim Löschen des Meetings.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto overflow-x-hidden break-words">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Video className="h-5 w-5 text-[#4b53bc]" /> {isEdit ? 'Meeting bearbeiten' : 'Meeting planen'}
          </DialogTitle>
        </DialogHeader>

        {result ? (
          <div className="space-y-4">
            {result.sync?.created ? (
              <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-700 dark:bg-emerald-900/20">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <p className="text-sm text-emerald-800 dark:text-emerald-300">
                  Meeting geplant – Einladungen wurden an {result.attendees.length} Teilnehmer versendet.
                </p>
              </div>
            ) : (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-900/20">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <div className="text-sm text-amber-800 dark:text-amber-300">
                  <p className="font-medium">Plantafel-Eintrag angelegt, aber kein Teams-Meeting / keine Einladung.</p>
                  <p className="mt-0.5 text-xs">
                    {result.sync?.reason === 'not_connected'
                      ? 'Microsoft 365 ist nicht verbunden. Bitte in den Einstellungen verbinden.'
                      : result.sync?.reason === 'no_calendar_module'
                        ? 'Das Modul „Kalender" ist in den Microsoft-365-Einstellungen nicht aktiviert. Modul aktivieren, danach neu verbinden (für die Kalender-Berechtigung) und das Meeting erneut speichern.'
                        : `Grund: ${result.sync?.reason || 'unbekannt'}. Ggf. Microsoft 365 mit aktiviertem Modul „Kalender" neu verbinden.`}
                  </p>
                </div>
              </div>
            )}

            <div className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700">
              <p className="font-medium text-slate-800 dark:text-slate-100">{result.titel}</p>
              <p className="text-slate-500 dark:text-slate-400">{fmt(result.von)} – {fmt(result.bis)}</p>
              {result.attendees.length > 0 && (
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Teilnehmer: {result.attendees.map((a) => a.name || a.email).join(', ')}
                </p>
              )}
            </div>

            {result.sync?.joinUrl && (
              <div className="space-y-2">
                <Label>Microsoft-Teams-Besprechung</Label>
                <div className="flex flex-wrap gap-2">
                  <Button asChild className="min-w-0 flex-1 bg-[#4b53bc] text-white hover:bg-[#3f46a8]">
                    <a href={result.sync.joinUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="mr-1 h-4 w-4 shrink-0" />
                      <span className="truncate">An Besprechung teilnehmen</span>
                    </a>
                  </Button>
                  <Button variant="outline" className="shrink-0" onClick={() => copy(result.sync!.joinUrl!, 'join')}>
                    <Copy className="mr-1 h-4 w-4" /> {copied === 'join' ? 'Kopiert' : 'Link'}
                  </Button>
                </div>
                {result.sync.eventId && (
                  <details className="text-[11px] text-slate-400">
                    <summary className="cursor-pointer select-none">Meeting-Referenz</summary>
                    <p className="mt-1 break-all font-mono text-slate-400">{result.sync.eventId}</p>
                  </details>
                )}
                <div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      copy(
                        [
                          result.titel,
                          `${fmt(result.von)} – ${fmt(result.bis)}`,
                          '',
                          `An Microsoft-Teams-Besprechung teilnehmen:`,
                          result.sync!.joinUrl!,
                        ].join('\n'),
                        'invite'
                      )
                    }
                  >
                    <Copy className="mr-1 h-4 w-4" /> {copied === 'invite' ? 'Kopiert' : 'Einladungstext kopieren'}
                  </Button>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-1">
              <Button onClick={onClose}>Schließen</Button>
            </div>
          </div>
        ) : isLoading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Meeting wird geladen…
          </div>
        ) : (
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

          <p className={`text-xs ${invitableCount === 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'}`}>
            {invitableCount === 0
              ? 'Noch keine Teilnehmer mit E-Mail – es wird keine Einladung versendet.'
              : `${invitableCount} Teilnehmer erhalten eine Einladung.`}
          </p>

          <div className="space-y-1.5">
            <Label>Notizen</Label>
            <Textarea value={notizen} onChange={(e) => setNotizen(e.target.value)} rows={2} placeholder="Optional" />
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <div className="flex items-center justify-between gap-2 pt-1">
            <div>
              {isEdit && (
                <Button
                  variant="outline"
                  onClick={handleDelete}
                  disabled={isSaving}
                  className="text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-700 dark:hover:bg-red-900/20"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  {confirmDelete ? 'Wirklich löschen?' : 'Löschen'}
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose} disabled={isSaving}>Abbrechen</Button>
              <Button onClick={handleSubmit} disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Video className="h-4 w-4 mr-1" />}
                {isEdit ? 'Speichern' : 'Meeting anlegen'}
              </Button>
            </div>
          </div>
        </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
