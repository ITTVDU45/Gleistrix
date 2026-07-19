"use client";
import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { logger } from '@/lib/logger'
import { getErrorMessage } from '@/lib/errors'
import { SubPortalApi, type PortalProjectListItem } from '@/lib/api/subunternehmenPortal'
import { formatDate, formatHours, PROJECT_STATUS_LABELS } from '@/lib/subunternehmen/format'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Building2, Search } from 'lucide-react'

const projectStatusBadge = (status: string): string => {
  switch (status) {
    case 'aktiv':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
    case 'geleistet':
    case 'abgeschlossen':
    case 'fertiggestellt':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
    case 'teilweise_abgerechnet':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
    default:
      return 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
  }
}

export default function PortalProjektePage() {
  const [projects, setProjects] = useState<PortalProjectListItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const data = await SubPortalApi.projects()
        setProjects(data.projects || [])
      } catch (err) {
        logger.error('Portal: Projekte konnten nicht geladen werden', err)
        setError(getErrorMessage(err))
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return projects
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        p.projectNumber.toLowerCase().includes(term) ||
        p.baustelle.toLowerCase().includes(term)
    )
  }, [projects, search])

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">Meine Projekte</h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">
          Projekte, in denen Ihr Unternehmen eingeplant ist
        </p>
      </div>

      {error && (
        <Alert variant="destructive" className="rounded-xl">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card className="border-0 shadow-lg bg-white dark:bg-slate-800 rounded-2xl">
        <CardHeader>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Projekt, Nummer oder Einsatzort suchen…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-11 rounded-xl"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="h-10 w-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-slate-500 dark:text-slate-400">
                {projects.length === 0
                  ? 'Ihrem Unternehmen sind aktuell keine Projekte zugeordnet.'
                  : 'Keine Projekte für diese Suche gefunden.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Projektnummer</TableHead>
                    <TableHead>Projekt</TableHead>
                    <TableHead>Einsatzort</TableHead>
                    <TableHead>Zeitraum</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Einsätze</TableHead>
                    <TableHead className="text-right">Mitarbeiter</TableHead>
                    <TableHead className="text-right">Geplant</TableHead>
                    <TableHead className="text-right">Bestätigt</TableHead>
                    <TableHead className="text-right">Abrechenbar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p) => (
                    <TableRow key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                      <TableCell className="font-mono text-sm">{p.projectNumber}</TableCell>
                      <TableCell>
                        <Link
                          href={`/subunternehmen/projekte/${p.id}`}
                          className="font-medium text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          {p.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm">{p.baustelle || '–'}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        {formatDate(p.datumBeginn)} – {formatDate(p.datumEnde)}
                      </TableCell>
                      <TableCell>
                        <Badge className={`rounded-lg px-2 py-0.5 text-xs ${projectStatusBadge(p.status)}`}>
                          {PROJECT_STATUS_LABELS[p.status] || p.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{p.einsatzCount}</TableCell>
                      <TableCell className="text-right">{p.mitarbeiterCount}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{formatHours(p.stundenGeplant)}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{formatHours(p.stundenBestaetigt)}</TableCell>
                      <TableCell className="text-right">
                        {p.billableCount > 0 ? (
                          <Badge className="rounded-lg px-2 py-0.5 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                            {p.billableCount} offen
                          </Badge>
                        ) : (
                          <span className="text-slate-400 text-sm">–</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
