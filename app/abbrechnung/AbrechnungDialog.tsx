"use client"
import React from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog'
import { Button } from '../../components/ui/button'
import { ScrollArea } from '../../components/ui/scroll-area'
import { format, parseISO } from 'date-fns'
import { Download } from 'lucide-react'

type BillingPositionRow = {
  id: string
  rowKey: string
  day: string
  isExternal: boolean
  companyName?: string
  employeeName?: string
  funktion: string
  count: number
  stundenPerUnit: number
  stundenTotal: number
  isBilled?: boolean
  billingStatus?: 'billed' | 'copied' | null
}

type BillingResponse = {
  success?: boolean
  message?: string
  pdf?: {
    filename?: string
    mimeType?: string
    base64?: string
  } | null
}

type Props = { open: boolean; onOpenChange: (v: boolean) => void; projectId?: string | null; onFinished?: (ok?: boolean) => void }

export default function AbrechnungDialog({ open, onOpenChange, projectId, onFinished }: Props){
  const [selectedDays, setSelectedDays] = React.useState<string[]>([])
  const [projectDays, setProjectDays] = React.useState<string[]>([])
  const [projectName, setProjectName] = React.useState<string | null>(null)
  const [billedDays, setBilledDays] = React.useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [step, setStep] = React.useState<1 | 2>(1)
  const [positions, setPositions] = React.useState<BillingPositionRow[]>([])
  const [selectedRows, setSelectedRows] = React.useState<string[]>([])
  const [isLoadingPositions, setIsLoadingPositions] = React.useState(false)

  React.useEffect(() => {
    if (!projectId) {
      setProjectDays([])
      setProjectName(null)
      setStep(1)
      setPositions([])
      setSelectedRows([])
      return
    }
    fetch(`/api/projects/${projectId}`).then(async r => {
      if (!r.ok) throw new Error('Failed to load project')
      const j = await r.json()
      const proj = j.project || j
      const baseDays: string[] = Object.keys(proj.mitarbeiterZeiten || {})
      const extraDays: Set<string> = new Set()
      try {
        Object.entries(proj.mitarbeiterZeiten || {}).forEach(([day, arr]: any) => {
          if (!Array.isArray(arr)) return
          arr.forEach((e: any) => {
            const endStr: string | undefined = e?.ende || e?.end
            if (typeof endStr === 'string' && endStr.includes('T')) {
              const endDay = endStr.slice(0,10)
              if (endDay && endDay !== day) extraDays.add(endDay)
            }
          })
        })
      } catch {}
      const days = Array.from(new Set([...baseDays, ...extraDays])).sort()
      const billed = Array.isArray(proj.abgerechneteTage) ? proj.abgerechneteTage : []
      setProjectDays(days)
      setBilledDays(billed)
      setProjectName(proj.name || null)
      setStep(1)
      setPositions([])
      setSelectedRows([])
    }).catch(()=>{
      setProjectDays([])
      setBilledDays([])
      setProjectName(null)
    })
  }, [projectId])

  const toggleDay = (day: string) => setSelectedDays(prev => prev.includes(day) ? prev.filter(d=>d!==day) : [...prev, day])
  const selectAll = () => setSelectedDays([...projectDays])
  const selectNone = () => setSelectedDays([])

  const loadPositions = async () => {
    if (!projectId || selectedDays.length === 0) return
    setIsLoadingPositions(true)
    try {
      const q = encodeURIComponent(selectedDays.join(','))
      const r = await fetch(`/api/abbrechnung/positions?projectId=${projectId}&days=${q}`)
      if (!r.ok) throw new Error('Fehler beim Laden der Positionen')
      const j = await r.json()
      const list: BillingPositionRow[] = Array.isArray(j.positions) ? j.positions : []
      setPositions(list)
      setSelectedRows(list.filter((p) => !p.isBilled).map((p) => p.rowKey))
      setStep(2)
    } catch (e) {
      console.error(e)
    } finally {
      setIsLoadingPositions(false)
    }
  }

  const toggleRow = (rowKey: string) => {
    setSelectedRows((prev) => prev.includes(rowKey) ? prev.filter((v) => v !== rowKey) : [...prev, rowKey])
  }

  const selectAllOpenRows = () => {
    setSelectedRows(positions.filter((p) => !p.isBilled).map((p) => p.rowKey))
  }

  const selectNoneRows = () => setSelectedRows([])

  const handleAbrechnen = async () => {
    if (!projectId) return
    setIsSubmitting(true)
    try {
      const copyDays = Array.from(new Set(
        positions
          .filter((p) => selectedRows.includes(p.rowKey) && p.isBilled)
          .map((p) => p.day)
      ))

      const res = await fetch('/api/abbrechnung', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ projectId, days: selectedDays, copyDays, selectedRowKeys: selectedRows })
      })
      const json: BillingResponse = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(json?.message || 'Serverfehler beim Erstellen der Abrechnung')
      }

      if (json?.pdf?.base64) {
        const contentType = json.pdf.mimeType || 'application/pdf'
        const binaryString = atob(json.pdf.base64)
        const len = binaryString.length
        const bytes = new Uint8Array(len)
        for (let i = 0; i < len; i += 1) bytes[i] = binaryString.charCodeAt(i)
        const blob = new Blob([bytes], { type: contentType })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = json.pdf.filename || `${projectName || 'abrechnung'}.pdf`
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(url)
      }

      if (onFinished) onFinished(true)
    } catch (e) {
      console.error('Abrechnung fehlgeschlagen', e)
      if (onFinished) onFinished(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  const positionRowsSorted = [...positions].sort((a, b) => {
    if (a.day !== b.day) return a.day.localeCompare(b.day)
    const aName = a.isExternal ? (a.companyName || '') : (a.employeeName || '')
    const bName = b.isExternal ? (b.companyName || '') : (b.employeeName || '')
    return `${aName}-${a.funktion}`.localeCompare(`${bName}-${b.funktion}`, 'de')
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>{projectName ? `Abrechnung: ${projectName}` : 'Abrechnung'}</DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-slate-600">{projectName ? `Projekt: ${projectName}` : 'Projekt wird geladen...'}</div>
              <div className="text-sm text-slate-600">Ausgewählt: <strong className="text-slate-800">{selectedDays.length}</strong></div>
            </div>

            <div className="flex gap-2">
              <Button size="sm" onClick={selectAll} disabled={projectDays.length===0}>Alle Tage</Button>
              <Button size="sm" onClick={selectNone} variant="outline">Keine Tage</Button>
            </div>

            <ScrollArea className="h-64 rounded-md border border-slate-100 dark:border-slate-700 p-3">
              <div className="grid grid-cols-3 gap-2">
                {projectDays.length === 0 ? (
                  <div className="col-span-3 text-slate-500">Keine verfügbaren Tage.</div>
                ) : (
                  projectDays.map(day => {
                    const isBilled = billedDays.includes(day)
                    const isSelected = selectedDays.includes(day)
                    return (
                      <button key={day} className={`py-2 px-3 rounded-lg text-sm text-left border ${isSelected ? 'bg-blue-600 text-white border-blue-600' : isBilled ? 'bg-yellow-50 text-amber-800 border-slate-200 hover:bg-yellow-100' : 'bg-slate-100 dark:bg-slate-800 border-transparent'} transition`} onClick={() => { toggleDay(day) }}>
                        <div className="font-medium">{format(parseISO(day), 'dd.MM.yyyy')}</div>
                        <div className="text-xs mt-1">{isBilled ? <span className="text-amber-700">bereits teilweise/komplett abgerechnet</span> : <span className="text-slate-500">offen</span>}</div>
                      </button>
                    )
                  })
                )}
              </div>
            </ScrollArea>
          </div>
        )}

        {step === 2 && (
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-slate-600">Positionen: <strong>{positions.length}</strong></div>
              <div className="text-sm text-slate-600">Ausgewählt: <strong>{selectedRows.length}</strong></div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={selectAllOpenRows}>Alle offenen</Button>
              <Button size="sm" variant="outline" onClick={selectNoneRows}>Keine</Button>
            </div>

            <ScrollArea className="h-80 rounded-md border border-slate-100 dark:border-slate-700">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="p-2 text-left w-12"></th>
                    <th className="p-2 text-left">Datum</th>
                    <th className="p-2 text-left">Mitarbeiter/Sub</th>
                    <th className="p-2 text-left">Funktion</th>
                    <th className="p-2 text-left">Anzahl</th>
                    <th className="p-2 text-left">Stunden je</th>
                    <th className="p-2 text-left">Stunden gesamt</th>
                    <th className="p-2 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {positionRowsSorted.map((row) => {
                    const label = row.isExternal ? (row.companyName || '-') : (row.employeeName || '-')
                    const checked = selectedRows.includes(row.rowKey)
                    return (
                      <tr key={row.rowKey} className="border-t border-slate-100">
                        <td className="p-2">
                          <input type="checkbox" checked={checked} onChange={() => toggleRow(row.rowKey)} />
                        </td>
                        <td className="p-2">{format(parseISO(row.day), 'dd.MM.yyyy')}</td>
                        <td className="p-2">{label}</td>
                        <td className="p-2">{row.funktion}</td>
                        <td className="p-2">{row.count}</td>
                        <td className="p-2">{row.stundenPerUnit.toFixed(2)}h</td>
                        <td className="p-2 font-medium">{row.stundenTotal.toFixed(2)}h</td>
                        <td className="p-2">{row.isBilled ? 'Bereits abgerechnet' : 'Offen'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </ScrollArea>
          </div>
        )}

        <DialogFooter className="flex items-center justify-end gap-2">
          {step === 2 ? (
            <Button variant="outline" onClick={() => setStep(1)} disabled={isSubmitting}>Zurück</Button>
          ) : (
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Abbrechen</Button>
          )}

          {step === 1 ? (
            <Button onClick={loadPositions} disabled={isLoadingPositions || selectedDays.length===0} className="bg-blue-600 hover:bg-blue-700 text-white">
              {isLoadingPositions ? 'Lade Positionen...' : 'Weiter'}
            </Button>
          ) : (
            <Button onClick={handleAbrechnen} disabled={isSubmitting || selectedRows.length===0} className={`flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 ${isSubmitting ? 'opacity-70 pointer-events-none' : ''}`}>
              <Download className="h-4 w-4" />
              {isSubmitting ? 'Abrechnen...' : 'Abrechnen'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
