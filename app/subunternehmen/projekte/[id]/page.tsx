"use client";
import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { logger } from '@/lib/logger'
import { getErrorMessage } from '@/lib/errors'
import { SubPortalApi, type PortalProjectDetail } from '@/lib/api/subunternehmenPortal'
import {
  ASSIGNMENT_STATUS_META,
  formatDate,
  formatHours,
  PROJECT_STATUS_LABELS,
} from '@/lib/subunternehmen/format'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
import { ArrowLeft, FileText, MapPin, Phone, User } from 'lucide-react'

export default function PortalProjektDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [project, setProject] = useState<PortalProjectDetail | null>(null)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const data = await SubPortalApi.project(String(params.id))
        setProject(data.project)
      } catch (err) {
        logger.error('Portal: Projektdetail konnte nicht geladen werden', err)
        setError(getErrorMessage(err))
      } finally {
        setIsLoading(false)
      }
    }
    if (params?.id) load()
  }, [params?.id])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="max-w-xl space-y-4">
        <Alert variant="destructive" className="rounded-xl">
          <AlertDescription>{error || 'Projekt nicht gefunden'}</AlertDescription>
        </Alert>
        <Button variant="outline" onClick={() => router.push('/subunternehmen/projekte')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Zurück zu Meine Projekte
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/subunternehmen/projekte')}
            className="mb-2 -ml-2 text-slate-500"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Meine Projekte
          </Button>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">{project.name}</h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-slate-600 dark:text-slate-400">
            <span className="font-mono">{project.projectNumber}</span>
            {project.baustelle && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {project.baustelle}
              </span>
            )}
            <span>
              {formatDate(project.datumBeginn)} – {formatDate(project.datumEnde)}
            </span>
            <Badge className="rounded-lg px-2 py-0.5 text-xs bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300">
              {PROJECT_STATUS_LABELS[project.status] || project.status}
            </Badge>
          </div>
        </div>
        {project.billableCount > 0 && (
          <Button
            onClick={() => router.push(`/subunternehmen/rechnungen/neu?projectId=${project.id}`)}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg"
          >
            <FileText className="h-4 w-4 mr-2" />
            {project.billableCount} Leistungen abrechnen
          </Button>
        )}
      </div>

      {/* Summen */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Einsätze', value: String(project.sums.einsaetze) },
          { label: 'Mitarbeiter', value: String(project.sums.mitarbeiter) },
          { label: 'Stunden', value: formatHours(project.sums.stunden) },
          { label: 'Nachtstunden', value: formatHours(project.sums.nachtzulage) },
          { label: 'Sonntagsstunden', value: formatHours(project.sums.sonntagsstunden) },
          { label: 'Feiertagsstunden', value: formatHours(project.sums.feiertag) },
        ].map((kpi) => (
          <Card key={kpi.label} className="border-0 shadow bg-white/80 dark:bg-slate-800/80 backdrop-blur rounded-xl">
            <CardContent className="p-4 text-center">
              <p className="text-lg font-bold text-slate-900 dark:text-white">{kpi.value}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{kpi.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Ansprechpartner */}
      {(project.ansprechpartner || project.telefonnummer) && (
        <Card className="border-0 shadow-lg bg-white dark:bg-slate-800 rounded-2xl">
          <CardContent className="p-5 flex flex-wrap items-center gap-6 text-sm text-slate-700 dark:text-slate-300">
            {project.ansprechpartner && (
              <span className="inline-flex items-center gap-2">
                <User className="h-4 w-4 text-blue-600" />
                {project.ansprechpartner}
              </span>
            )}
            {project.ansprechpartnerEmail && (
              <a
                href={`mailto:${project.ansprechpartnerEmail}`}
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                {project.ansprechpartnerEmail}
              </a>
            )}
            {project.telefonnummer && (
              <span className="inline-flex items-center gap-2">
                <Phone className="h-4 w-4 text-blue-600" />
                {project.telefonnummer}
              </span>
            )}
          </CardContent>
        </Card>
      )}

      {/* Einsätze */}
      <Card className="border-0 shadow-lg bg-white dark:bg-slate-800 rounded-2xl">
        <CardHeader>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Einsätze & Stunden</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Nur die Einsätze Ihres Unternehmens – Grundlage für die Rechnungserstellung
          </p>
        </CardHeader>
        <CardContent>
          {project.einsaetze.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400 py-6 text-center">
              Keine Einsätze vorhanden.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Datum</TableHead>
                    <TableHead>Rolle / Funktion</TableHead>
                    <TableHead className="text-right">Mitarbeiter</TableHead>
                    <TableHead>Start</TableHead>
                    <TableHead>Ende</TableHead>
                    <TableHead>Pause</TableHead>
                    <TableHead className="text-right">Stunden</TableHead>
                    <TableHead className="text-right">Nacht</TableHead>
                    <TableHead className="text-right">Sonntag</TableHead>
                    <TableHead className="text-right">Feiertag</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Rechnung</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {project.einsaetze.map((a) => {
                    const meta = ASSIGNMENT_STATUS_META[a.status]
                    return (
                      <TableRow key={a.assignmentKey} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                        <TableCell className="whitespace-nowrap">{formatDate(a.day)}</TableCell>
                        <TableCell>{a.funktion}</TableCell>
                        <TableCell className="text-right">{a.count}</TableCell>
                        <TableCell>{a.start || '–'}</TableCell>
                        <TableCell>{a.ende || '–'}</TableCell>
                        <TableCell>{a.pause || '–'}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">{formatHours(a.stundenTotal)}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">{formatHours(a.nachtzulageTotal)}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">{formatHours(a.sonntagsstundenTotal)}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">{formatHours(a.feiertagTotal)}</TableCell>
                        <TableCell>
                          <Badge className={`rounded-lg px-2 py-0.5 text-xs ${meta.className}`}>{meta.label}</Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          {a.invoiceNumbers?.length ? (
                            <span className="font-mono">{a.invoiceNumbers.join(', ')}</span>
                          ) : (
                            <span className="text-slate-400">–</span>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="text-sm text-slate-500 dark:text-slate-400">
        Freigegebene Dokumente zu diesem Projekt finden Sie unter{' '}
        <Link href={`/subunternehmen/dokumente?projectId=${project.id}`} className="text-blue-600 dark:text-blue-400 hover:underline">
          Dokumente
        </Link>
        .
      </div>
    </div>
  )
}
