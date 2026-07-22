"use client"
import { useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Coins, Loader2, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { fetchWithIntent } from '@/lib/http/fetchWithIntent'
import { MITARBEITER_FUNKTION_OPTIONS } from '@/types/constants'

interface BulkEmployee { id: string; name: string; miNumber?: number }

const todayInput = () => new Date().toISOString().slice(0, 10)
const toCents = (value: string) => Math.round((Number(String(value).replace(',', '.')) || 0) * 100)

/**
 * Weist mehreren Mitarbeitern in einem Schritt denselben Stundenlohn für eine Funktion zu.
 * Nur für Super-Admins sichtbar (vertrauliche Sätze).
 */
export default function EmployeeWageBulkDialog({ employees }: { employees: BulkEmployee[] }) {
  const { data: session } = useSession()
  const [open, setOpen] = useState(false)
  const [funktion, setFunktion] = useState('')
  const [validFrom, setValidFrom] = useState(todayInput())
  const [base, setBase] = useState('')
  const [travel, setTravel] = useState('')
  const [night, setNight] = useState('25')
  const [sunday, setSunday] = useState('50')
  const [holiday, setHoliday] = useState('100')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ created: number; duplicate: number; failed: number } | null>(null)

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('de')
    return employees.filter(item => !term || item.name.toLocaleLowerCase('de').includes(term) || String(item.miNumber || '').includes(term))
  }, [employees, search])

  if (session?.user?.role !== 'superadmin') return null

  const toggle = (id: string) => setSelected(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })
  const allFilteredSelected = filtered.length > 0 && filtered.every(item => selected.has(item.id))
  const toggleAll = () => setSelected(prev => {
    const next = new Set(prev)
    if (allFilteredSelected) filtered.forEach(item => next.delete(item.id))
    else filtered.forEach(item => next.add(item.id))
    return next
  })

  const reset = () => { setFunktion(''); setBase(''); setTravel(''); setNight('25'); setSunday('50'); setHoliday('100'); setSelected(new Set()); setSearch(''); setResult(null); setError('') }

  const apply = async () => {
    setBusy(true); setError(''); setResult(null)
    const payloadBase = {
      funktion, validFrom,
      baseHourlyCents: toCents(base), travelHourlyCents: toCents(travel),
      nightSurchargePercent: Number(night) || 0, sundaySurchargePercent: Number(sunday) || 0, holidaySurchargePercent: Number(holiday) || 0,
    }
    let created = 0, duplicate = 0, failed = 0
    try {
      for (const employeeId of selected) {
        const response = await fetchWithIntent('/api/finanzen/employee-rates', { method: 'POST', intent: 'finance:rate:create', body: JSON.stringify({ ...payloadBase, employeeId }) })
        if (response.ok) created += 1
        else if (response.status === 409) duplicate += 1
        else failed += 1
      }
      setResult({ created, duplicate, failed })
      if (failed === 0 && duplicate === 0) { setSelected(new Set()) }
    } catch {
      setError('Zuweisung fehlgeschlagen.')
    } finally {
      setBusy(false)
    }
  }

  return <>
    <Button variant="outline" size="sm" onClick={() => { reset(); setOpen(true) }}>
      <Coins className="mr-2 h-4 w-4" />Löhne je Funktion
    </Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Stundenlohn je Funktion zuweisen</DialogTitle>
          <DialogDescription>Definiere einen Satz für eine Funktion und weise ihn ausgewählten Mitarbeitern zu. Vorhandene Sätze (gleicher Mitarbeiter, Funktion und Gültigkeitsdatum) werden übersprungen.</DialogDescription>
        </DialogHeader>

        {error && <div className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">{error}</div>}
        {result && <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
          {result.created} Satz/Sätze angelegt{result.duplicate ? `, ${result.duplicate} bereits vorhanden` : ''}{result.failed ? `, ${result.failed} fehlgeschlagen` : ''}.
        </div>}

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Funktion">
            <Select value={funktion} onValueChange={setFunktion}>
              <SelectTrigger><SelectValue placeholder="Funktion wählen" /></SelectTrigger>
              <SelectContent>{MITARBEITER_FUNKTION_OPTIONS.map(item => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Gültig ab"><Input type="date" value={validFrom} onChange={event => setValidFrom(event.target.value)} /></Field>
          <Field label="Grundlohn (€ / h)"><Input type="number" step="0.01" value={base} onChange={event => setBase(event.target.value)} /></Field>
          <Field label="Fahrt (€ / h)"><Input type="number" step="0.01" value={travel} onChange={event => setTravel(event.target.value)} /></Field>
          <Field label="Nacht (%)"><Input type="number" value={night} onChange={event => setNight(event.target.value)} /></Field>
          <Field label="Sonntag (%)"><Input type="number" value={sunday} onChange={event => setSunday(event.target.value)} /></Field>
          <Field label="Feiertag (%)"><Input type="number" value={holiday} onChange={event => setHoliday(event.target.value)} /></Field>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Mitarbeiter ({selected.size} ausgewählt)</Label>
            <Button variant="ghost" size="sm" onClick={toggleAll}>{allFilteredSelected ? 'Auswahl aufheben' : 'Alle auswählen'}</Button>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <Input className="pl-8" placeholder="Mitarbeiter suchen…" value={search} onChange={event => setSearch(event.target.value)} />
          </div>
          <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border p-2">
            {filtered.length ? filtered.map(item => (
              <label key={item.id} className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800">
                <Checkbox checked={selected.has(item.id)} onCheckedChange={() => toggle(item.id)} />
                <span className="text-sm">{item.name}{item.miNumber ? <span className="text-slate-400"> · {item.miNumber}</span> : null}</span>
              </label>
            )) : <p className="px-2 py-4 text-center text-sm text-slate-500">Keine Mitarbeiter gefunden.</p>}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Schließen</Button>
          <Button onClick={() => void apply()} disabled={busy || !funktion || !base || selected.size === 0}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{selected.size ? `${selected.size} Mitarbeitern zuweisen` : 'Zuweisen'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>
}
