'use client'

import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Plus, Trash2, ListTree } from 'lucide-react'
import type { LeistungsPhase, LeistungsPosition } from '../types'

interface ProjectLeistungenEditorProps {
  value: LeistungsPhase[]
  onChange: (value: LeistungsPhase[]) => void
}

function uid(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  } catch { /* fallback */ }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function emptyPosition(): LeistungsPosition {
  return { id: uid(), nummer: '', bezeichnung: '', beschreibung: '', menge: '', einheit: '', einzelpreis: '', gesamtsumme: '' }
}

function emptyPhase(): LeistungsPhase {
  return { id: uid(), subtitel: '', titel: '', positionen: [emptyPosition()] }
}

export default function ProjectLeistungenEditor({ value, onChange }: ProjectLeistungenEditorProps) {
  const phases = value || []

  const updatePhase = (pi: number, patch: Partial<LeistungsPhase>) => {
    onChange(phases.map((p, i) => (i === pi ? { ...p, ...patch } : p)))
  }
  const removePhase = (pi: number) => onChange(phases.filter((_, i) => i !== pi))
  const addPhase = () => onChange([...phases, emptyPhase()])

  const updatePos = (pi: number, xi: number, patch: Partial<LeistungsPosition>) => {
    updatePhase(pi, { positionen: phases[pi].positionen.map((x, i) => (i === xi ? { ...x, ...patch } : x)) })
  }
  const removePos = (pi: number, xi: number) => {
    updatePhase(pi, { positionen: phases[pi].positionen.filter((_, i) => i !== xi) })
  }
  const addPos = (pi: number) => {
    updatePhase(pi, { positionen: [...phases[pi].positionen, emptyPosition()] })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
          <ListTree className="h-4 w-4" /> Leistungen
        </p>
        <Button type="button" size="sm" variant="outline" onClick={addPhase}>
          <Plus className="mr-1 h-4 w-4" /> Leistungsphase
        </Button>
      </div>

      {phases.length === 0 && (
        <p className="text-xs text-slate-400">Noch keine Leistungen. Mit „Leistungsphase" hinzufügen.</p>
      )}

      {phases.map((phase, pi) => (
        <div key={phase.id} className="space-y-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <div>
              <Label className="text-xs">Subtitel</Label>
              <Input
                value={phase.subtitel || ''}
                onChange={(e) => updatePhase(pi, { subtitel: e.target.value })}
                placeholder="z. B. technische Sicherung"
              />
            </div>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Label className="text-xs">Titel</Label>
                <Input
                  value={phase.titel || ''}
                  onChange={(e) => updatePhase(pi, { titel: e.target.value })}
                  placeholder="z. B. Feste Absperrung (FA)"
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                onClick={() => removePhase(pi)}
                title="Leistungsphase entfernen"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            {phase.positionen.map((pos, xi) => (
              <div key={pos.id} className="rounded-md border border-slate-100 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-800/50">
                <div className="flex items-start gap-2">
                  <div className="w-40 shrink-0">
                    <Label className="text-[11px] text-slate-500">Position-Nr.</Label>
                    <Input
                      value={pos.nummer || ''}
                      onChange={(e) => updatePos(pi, xi, { nummer: e.target.value })}
                      placeholder="02.01.0010"
                    />
                  </div>
                  <div className="flex-1">
                    <Label className="text-[11px] text-slate-500">Bezeichnung</Label>
                    <Input
                      value={pos.bezeichnung || ''}
                      onChange={(e) => updatePos(pi, xi, { bezeichnung: e.target.value })}
                      placeholder="Kurztitel"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-5 h-9 shrink-0 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                    onClick={() => removePos(pi, xi)}
                    title="Position entfernen"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="mt-2">
                  <Label className="text-[11px] text-slate-500">Beschreibung</Label>
                  <Input
                    value={pos.beschreibung || ''}
                    onChange={(e) => updatePos(pi, xi, { beschreibung: e.target.value })}
                    placeholder="Langtext"
                  />
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
                  <div>
                    <Label className="text-[11px] text-slate-500">Menge</Label>
                    <Input value={pos.menge || ''} onChange={(e) => updatePos(pi, xi, { menge: e.target.value })} placeholder="14,00" />
                  </div>
                  <div>
                    <Label className="text-[11px] text-slate-500">Einheit</Label>
                    <Input value={pos.einheit || ''} onChange={(e) => updatePos(pi, xi, { einheit: e.target.value })} placeholder="Stück / Meter / Tage" />
                  </div>
                  <div>
                    <Label className="text-[11px] text-slate-500">Einzelpreis</Label>
                    <Input value={pos.einzelpreis || ''} onChange={(e) => updatePos(pi, xi, { einzelpreis: e.target.value })} placeholder="1.650,00 €" />
                  </div>
                  <div>
                    <Label className="text-[11px] text-slate-500">Gesamtsumme</Label>
                    <Input value={pos.gesamtsumme || ''} onChange={(e) => updatePos(pi, xi, { gesamtsumme: e.target.value })} placeholder="23.100,00 €" />
                  </div>
                </div>
              </div>
            ))}
            <Button type="button" size="sm" variant="outline" onClick={() => addPos(pi)}>
              <Plus className="mr-1 h-4 w-4" /> Position
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}
