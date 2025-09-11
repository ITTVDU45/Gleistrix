"use client"
import React from 'react'
import { Button } from '../../components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table'
import AbrechnungDialog from './AbrechnungDialog.tsx'
import AbrechnungFilter from './AbrechnungFilter'
import { Card, CardContent, CardHeader } from '../../components/ui/card'
import { Calendar, MapPin, User, Clock } from 'lucide-react'
import InlineStatusSelect from '../../components/InlineStatusSelect'
import { ProjectsApi } from '@/lib/api/projects'

type Props = { projects?: any[] }

export default function AbrechnungClient({ projects = [] }: Props){
  const [selectedProject, setSelectedProject] = React.useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [filteredProjects, setFilteredProjects] = React.useState<any[]>(projects)

  // keep a local copy to allow optimistic updates (status)
  const [localProjects, setLocalProjects] = React.useState<any[]>(projects)

  React.useEffect(() => {
    // projects passed from server only contain selected fields; mirror into localProjects
    setFilteredProjects(projects || [])
    setLocalProjects(projects || [])
  }, [projects])

  const handleFilterChange = React.useCallback((filtered: any[]) => {
    setFilteredProjects(filtered)
  }, [])

  // Ermittele den effektiven Abrechnungsstatus auf Basis der tatsächlich vorhandenen Arbeitstage
  // Hintergrund: Bei tagübergreifenden Einsätzen liegt der Eintrag unter dem Start-Tag.
  // Vollständig abgerechnet => alle Tage mit Zeiteinträgen (Keys in mitarbeiterZeiten) sind in abgerechneteTage enthalten.
  const getEffectiveStatus = React.useCallback((p: any): string => {
    try {
      const billed = new Set<string>(Array.isArray(p?.abgerechneteTage) ? (p.abgerechneteTage as any[]).map((d: any) => String(d)) : [])
      // Zähle nur Tage mit tatsächlichen Einträgen; Tage mit [] oder undefined ignorieren.
      // Ergänze Folgetage für tagübergreifende Einträge (Ende-Tag).
      const daysWithEntries: Record<string, true> = {}
      Object.entries(p?.mitarbeiterZeiten || {}).forEach(([day, arr]: any) => {
        if (Array.isArray(arr) && arr.length > 0) { daysWithEntries[day] = true }
        (Array.isArray(arr) ? arr : []).forEach((e: any) => {
          const endStr: string | undefined = e?.ende || e?.end
          if (typeof endStr === 'string' && endStr.includes('T')) {
            const endDay = endStr.slice(0,10)
            if (endDay && endDay !== day) daysWithEntries[endDay] = true
          }
        })
      })
      const daysWithEntriesArr = Object.keys(daysWithEntries)
      if (daysWithEntriesArr.length > 0 && daysWithEntriesArr.every(d => billed.has(String(d)))) {
        return 'geleistet'
      }
      // Teilweise, wenn es mindestens einen abgerechneten Tag gibt
      if (billed.size > 0) return 'teilweise_abgerechnet'
      return p?.status || 'kein Status'
    } catch {
      return p?.status || 'kein Status'
    }
  }, [])

  function getTotalHours(project: any) {
    try {
      const vals = Object.values(project.mitarbeiterZeiten || {}) as any[]
      const total = vals.reduce((sum: number, entries: any) => {
        const arr = Array.isArray(entries) ? entries : []
        return sum + arr.reduce((es: number, e: any) => es + (e.stunden || 0), 0)
      }, 0)
      return total
    } catch (e) { return 0 }
  }

  const formatHoursDot = (value: any): string => {
    const num = typeof value === 'number' ? value : parseFloat(String(value).replace(',', '.'))
    if (Number.isNaN(num)) return '-'
    const whole = Math.floor(num)
    const minutes = Math.round((num - whole) * 60)
    return `${whole}.${String(minutes).padStart(2, '0')}`
  }

  const handleStatusChange = async (projectId: string, newStatus: string) => {
    try {
      await ProjectsApi.updateStatus(projectId, newStatus)
      setLocalProjects(prev => prev.map(p => p.id === projectId ? { ...p, status: newStatus } : p))
      setFilteredProjects(prev => prev.map(p => p.id === projectId ? { ...p, status: newStatus } : p))
    } catch (e) {
      console.error('Status update failed', e)
    }
  }

  const [snackbar, setSnackbar] = React.useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' })
  const closeSnackbar = () => setSnackbar({ open: false, message: '', severity: 'success' })

  // Snackbar will be shown via onFinished callback from dialog

  return (
    <div className="space-y-6">
      {snackbar.open && (
        <div className={`fixed top-6 right-6 z-50 p-3 rounded-lg ${snackbar.severity === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
          {snackbar.message}
          <button onClick={closeSnackbar} className="ml-3 underline">OK</button>
        </div>
      )}
      <AbrechnungFilter projects={projects} onFilterChange={handleFilterChange} />

      <Card className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Projektliste</h2>
              <div className="text-sm text-slate-500">{(filteredProjects || []).length} Projekte</div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredProjects && filteredProjects.length > 0 ? (
            <div className="rounded-xl border border-slate-200 dark:border-slate-600 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 dark:bg-slate-700">
                    <TableHead className="font-medium text-slate-700 dark:text-slate-300">Projekt</TableHead>
                    <TableHead className="font-medium text-slate-700 dark:text-slate-300">Auftraggeber</TableHead>
                    <TableHead className="font-medium text-slate-700 dark:text-slate-300">Baustelle</TableHead>
                    <TableHead className="font-medium text-slate-700 dark:text-slate-300">Status</TableHead>
                    <TableHead className="font-medium text-slate-700 dark:text-slate-300">Datum</TableHead>
                    <TableHead className="font-medium text-slate-700 dark:text-slate-300">Stunden</TableHead>
                    <TableHead className="font-medium text-slate-700 dark:text-slate-300 text-right">Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProjects.map((p: any) => (
                    <TableRow key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-700">
                      <TableCell>
                        <div>
                          <p className="font-medium text-slate-900 dark:text-white">{p.name}</p>
                          <p className="text-sm text-slate-500 dark:text-slate-400">#{p.auftragsnummer || p.id}</p>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                          <span className="text-slate-700 dark:text-slate-300">{p.auftraggeber || '-'}</span>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                          <span className="text-slate-700 dark:text-slate-300">{p.baustelle || '-'}</span>
                        </div>
                      </TableCell>

                      <TableCell>
                        {(() => {
                          const effective = getEffectiveStatus(p)
                          // Für die Anzeige Status überschreiben, Backend-Status bleibt unberührt bis zur nächsten Abrechnung/Aktualisierung
                          return (
                            <InlineStatusSelect project={{ ...p, status: effective }} onStatusChange={(ns) => handleStatusChange(p.id, ns)} showInlineFeedback={false} />
                          )
                        })()}
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                          <span className="text-slate-700 dark:text-slate-300">{p.datumBeginn ? new Date(p.datumBeginn).toLocaleDateString('de-DE') : '-'}</span>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                          <span className="text-slate-700 dark:text-slate-300">{formatHoursDot(getTotalHours(p))}h</span>
                        </div>
                      </TableCell>

                      <TableCell className="text-right">
                        <Button size="sm" onClick={() => { setSelectedProject(p.id); setDialogOpen(true) }}>Abrechnen</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-slate-500">Keine Projekte gefunden.</div>
          )}
        </CardContent>
      </Card>

      <AbrechnungDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        projectId={selectedProject}
        onFinished={(ok?: boolean) => {
          setDialogOpen(false);
          if (ok) setSnackbar({ open: true, message: 'Abrechnung erfolgreich erstellt und E-Mail versendet', severity: 'success' })
          else setSnackbar({ open: true, message: 'Abrechnung fehlgeschlagen', severity: 'error' })
        }}
      />
    </div>
  )
}


