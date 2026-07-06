'use client'

import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { Upload } from 'lucide-react'
import type { PlantafelDayProject, PlantafelEvent } from './types'

interface ProjectDayCardProps {
  project: PlantafelDayProject
  einsatzEvents: PlantafelEvent[]
  onClick: () => void
  onFileDrop?: (files: File[]) => void
}

function dragHasFiles(e: React.DragEvent): boolean {
  return Array.from(e.dataTransfer?.types || []).includes('Files')
}

interface TimeRow {
  key: string
  start: string
  ende: string
  name: string
  funktion: string
  stunden: string
  extra: string
  fahrtstunden: string
}

const STATUS_COLORS: Record<string, string> = {
  aktiv: 'text-emerald-700 dark:text-emerald-400',
  abgeschlossen: 'text-blue-700 dark:text-blue-400',
  fertiggestellt: 'text-blue-700 dark:text-blue-400',
  geleistet: 'text-violet-700 dark:text-violet-400',
  teilweise_abgerechnet: 'text-amber-700 dark:text-amber-400',
}

function formatTime(value?: string): string {
  if (!value) return ''
  try {
    return format(new Date(value), 'HH:mm')
  } catch {
    return value
  }
}

function formatNumber(value?: number): string {
  if (value === undefined || value === null || Number.isNaN(value)) return ''
  if (value === 0) return ''
  return value.toLocaleString('de-DE', { maximumFractionDigits: 2 })
}

export default function ProjectDayCard({ project, einsatzEvents, onClick, onFileDrop }: ProjectDayCardProps) {
  const [isFileOver, setIsFileOver] = useState(false)
  const timeRows = useMemo<TimeRow[]>(() => {
    if (project.zeiten.length > 0) {
      return project.zeiten.map((z, idx) => ({
        key: z.id || `zeit-${idx}`,
        start: formatTime(z.start),
        ende: formatTime(z.ende),
        name: z.isExternal
          ? z.externalCompanyName || z.name || 'Extern'
          : z.name || '',
        funktion: z.isExternal
          ? z.externalFunctionSummary || String(z.funktion || '')
          : String(z.funktion || ''),
        stunden: formatNumber(z.stunden),
        extra: formatNumber(z.extra),
        fahrtstunden: formatNumber(z.fahrtstunden),
      }))
    }

    // Fallback: geplante Einsätze aus der Plantafel, wenn noch keine Zeiterfassung existiert
    return einsatzEvents.map((e) => ({
      key: e.id,
      start: formatTime(e.start instanceof Date ? e.start.toISOString() : String(e.start)),
      ende: formatTime(e.end instanceof Date ? e.end.toISOString() : String(e.end)),
      name: e.mitarbeiterName || 'Nicht zugewiesen',
      funktion: e.rolle || '',
      stunden: '',
      extra: '',
      fahrtstunden: '',
    }))
  }, [project.zeiten, einsatzEvents])

  const bemerkungen = useMemo(() => {
    const parts: string[] = []
    for (const z of project.zeiten) {
      if (z.bemerkung?.trim()) parts.push(z.bemerkung.trim())
    }
    for (const t of project.technik) {
      const label = t.name ? `${t.name}: ` : ''
      if (t.bemerkung?.trim()) parts.push(`${label}${t.bemerkung.trim()}`)
    }
    return parts.join(' · ')
  }, [project.zeiten, project.technik])

  const fahrzeugLabel = project.fahrzeuge
    .map((f) => [f.type, f.licensePlate].filter(Boolean).join(' '))
    .filter(Boolean)
    .join(', ')

  const cellLabel =
    'bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 px-2 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200'
  const cellValue =
    'border border-slate-300 dark:border-slate-600 px-2 py-1 text-xs text-slate-900 dark:text-white'

  return (
    <div
      onClick={onClick}
      onDragOver={(e) => {
        if (!onFileDrop || !dragHasFiles(e)) return
        e.preventDefault()
        e.stopPropagation()
        setIsFileOver(true)
      }}
      onDragLeave={(e) => {
        if (!onFileDrop) return
        e.preventDefault()
        e.stopPropagation()
        setIsFileOver(false)
      }}
      onDrop={(e) => {
        if (!onFileDrop || !dragHasFiles(e)) return
        e.preventDefault()
        e.stopPropagation()
        setIsFileOver(false)
        const files = Array.from(e.dataTransfer.files || [])
        if (files.length) onFileDrop(files)
      }}
      className={`relative rounded-lg border bg-white dark:bg-slate-800 overflow-hidden cursor-pointer hover:shadow-md transition-shadow ${
        isFileOver
          ? 'border-blue-500 ring-2 ring-blue-400/60'
          : 'border-slate-300 dark:border-slate-600'
      }`}
      title={`${project.name} — Details öffnen`}
    >
      {isFileOver && (
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-1 bg-blue-500/10 backdrop-blur-[1px]">
          <Upload className="h-8 w-8 text-blue-600" />
          <p className="text-sm font-medium text-blue-700 dark:text-blue-300">Dokument hier ablegen</p>
        </div>
      )}
      {/* Kopfblock im Excel-Stil */}
      <div className="grid grid-cols-[auto_1fr_auto_1fr]">
        <div className={cellLabel}>Status:</div>
        <div className={`${cellValue} font-medium ${STATUS_COLORS[project.status] || ''}`}>
          {project.status || '–'}
        </div>
        <div className={cellLabel}>Auftraggeber:</div>
        <div className={`${cellValue} font-semibold`}>{project.auftraggeber || '–'}</div>

        <div className={cellLabel}>Baustelle:</div>
        <div className={cellValue}>{project.baustelle || '–'}</div>
        <div className={cellLabel}>ATWS:</div>
        <div className={cellValue}>
          {project.atwsImEinsatz ? `Ja (Anzahl: ${project.anzahlAtws})` : '–'}
        </div>

        <div className={cellLabel}>Auftragsnummer:</div>
        <div className={cellValue}>{project.auftragsnummer || '–'}</div>
        <div className={cellLabel}>Fahrzeug:</div>
        <div className={cellValue}>{fahrzeugLabel || '–'}</div>

        <div className={cellLabel}>SAP-Nummer:</div>
        <div className={cellValue}>{project.sapNummer || '–'}</div>
        <div className={cellLabel}>Tel:</div>
        <div className={cellValue}>{project.telefonnummer || '–'}</div>
      </div>

      {/* Projektname */}
      <div className="border-x border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 px-2 py-1">
        <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{project.name}</p>
      </div>

      {/* Zeiten-Tabelle */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {['Uhrzeit start', 'Uhrzeit end', 'Name', 'Funktion', 'Stunden', 'Extra', 'Fahrtstd.'].map((h) => (
                <th key={h} className={`${cellLabel} text-center whitespace-nowrap`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {timeRows.length > 0 ? (
              timeRows.map((row) => (
                <tr key={row.key}>
                  <td className={`${cellValue} text-right whitespace-nowrap`}>{row.start}</td>
                  <td className={`${cellValue} text-right whitespace-nowrap`}>{row.ende}</td>
                  <td className={`${cellValue} whitespace-nowrap`}>{row.name}</td>
                  <td className={`${cellValue} whitespace-nowrap uppercase`}>{row.funktion}</td>
                  <td className={`${cellValue} text-right`}>{row.stunden}</td>
                  <td className={`${cellValue} text-right`}>{row.extra}</td>
                  <td className={`${cellValue} text-right`}>{row.fahrtstunden}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className={`${cellValue} text-center text-slate-400 dark:text-slate-500 py-3`}>
                  Keine Zeiteinträge
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Material/Bemerkung */}
      <div className="border border-slate-300 dark:border-slate-600 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-1 text-center text-xs font-semibold text-slate-700 dark:text-slate-200">
        Material/ Bemerkung:
      </div>
      <div className="border-x border-b border-slate-300 dark:border-slate-600 px-2 py-2 text-xs text-slate-700 dark:text-slate-300 min-h-[2.5rem]">
        {bemerkungen || <span className="text-slate-400 dark:text-slate-500">–</span>}
      </div>
    </div>
  )
}
