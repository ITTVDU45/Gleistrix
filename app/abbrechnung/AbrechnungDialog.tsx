"use client"
import React from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog'
import { Button } from '../../components/ui/button'
import { ScrollArea } from '../../components/ui/scroll-area'
import { format, parseISO } from 'date-fns'
import { Download } from 'lucide-react'

type Props = { open: boolean; onOpenChange: (v: boolean) => void; projectId?: string | null; onFinished?: (ok?: boolean) => void }

export default function AbrechnungDialog({ open, onOpenChange, projectId, onFinished }: Props){
  const [selectedDays, setSelectedDays] = React.useState<string[]>([])
  const [projectDays, setProjectDays] = React.useState<string[]>([])
  const [projectName, setProjectName] = React.useState<string | null>(null)
  const [billedDays, setBilledDays] = React.useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  React.useEffect(() => {
    if (!projectId) {
      setProjectDays([])
      setProjectName(null)
      return
    }
    // fetch project to get days (reusing ProjectDetail logic)
    fetch(`/api/projects/${projectId}`).then(async r => {
      if (!r.ok) throw new Error('Failed to load project')
      const j = await r.json()
      const proj = j.project || j
      // Basistage = Keys
      const baseDays: string[] = Object.keys(proj.mitarbeiterZeiten || {})
      // Zusatztage: Ende-Tag für tagübergreifende Einträge
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
    }).catch(()=>{
      setProjectDays([])
      setBilledDays([])
      setProjectName(null)
    })
  }, [projectId])

  const toggleDay = (day: string) => setSelectedDays(prev => prev.includes(day) ? prev.filter(d=>d!==day) : [...prev, day])

  const selectAll = () => setSelectedDays([...projectDays])
  const selectNone = () => setSelectedDays([])

  const handleAbrechnen = async () => {
    if (!projectId) return
    setIsSubmitting(true)
    try {
      // compute which selected days are already billed -> will be sent as copies
      const copyDays = selectedDays.filter(d => billedDays.includes(d))
      const res = await fetch('/api/abbrechnung', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ projectId, days: selectedDays, copyDays }) })
      if (!res.ok) {
        const json = await res.json().catch(()=>null)
        throw new Error((json && json.message) || 'Serverfehler beim Erstellen der Abrechnung')
      }
      // show success snackbar via postMessage to parent client
      if (onFinished) onFinished(true)
    } catch (e) {
      console.error('Abrechnung fehlgeschlagen', e)
      if (onFinished) onFinished(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{projectName ? `Abrechnung: ${projectName}` : 'Abrechnung - Tage auswählen'}</DialogTitle>
        </DialogHeader>

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
                      <div className="text-xs mt-1">
                        {isBilled ? (
                          <span className="text-amber-700">bereits abgerechnet — wird als Kopie versendet</span>
                        ) : (
                          <span className="text-slate-500">neu</span>
                        )}
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </ScrollArea>

          <div className="text-xs text-slate-500">Tipp: Wähle die Tage aus, die abgerechnet werden sollen. Du kannst später die erzeugten PDFs per E-Mail versenden.</div>
        </div>

        <DialogFooter className="flex items-center justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Abbrechen</Button>

          <Button onClick={handleAbrechnen} disabled={isSubmitting || selectedDays.length===0} className={`flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 ${isSubmitting ? 'opacity-70 pointer-events-none' : ''}`}>
            <Download className="h-4 w-4" />
            {isSubmitting ? 'Abrechnen...' : 'Abrechnen'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}


