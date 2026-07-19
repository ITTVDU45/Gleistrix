"use client";
import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { logger } from '@/lib/logger'
import { getErrorMessage } from '@/lib/errors'
import { SubPortalApi, type PortalDashboard } from '@/lib/api/subunternehmenPortal'
import { formatEuro, formatHours, formatDate, ASSIGNMENT_STATUS_META, INVOICE_STATUS_META } from '@/lib/subunternehmen/format'
import type { ReceivedInvoiceStatus } from '@/types/subunternehmen'
import PortalPromoBanner from '@/components/subunternehmen/PortalPromoBanner'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Building2,
  CalendarClock,
  Clock,
  FileText,
  FolderOpen,
  Plus,
  AlertTriangle,
} from 'lucide-react'

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string | number
  hint?: string
  href: string
}) {
  return (
    <Link href={href} className="block group">
      <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-800/80 backdrop-blur rounded-2xl transition-all duration-200 group-hover:shadow-xl group-hover:-translate-y-0.5">
        <CardContent className="p-5">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
              <Icon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="min-w-0">
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
              <p className="text-sm text-slate-600 dark:text-slate-400 truncate">{label}</p>
              {hint && <p className="text-xs text-slate-400 dark:text-slate-500 truncate">{hint}</p>}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

export default function SubunternehmenDashboardPage() {
  const router = useRouter()
  const [dashboard, setDashboard] = useState<PortalDashboard | null>(null)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const data = await SubPortalApi.dashboard()
        setDashboard(data.dashboard)
      } catch (err) {
        logger.error('Portal-Dashboard konnte nicht geladen werden', err)
        setError(getErrorMessage(err))
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (error || !dashboard) {
    return (
      <Alert variant="destructive" className="rounded-xl max-w-xl">
        <AlertDescription>{error || 'Dashboard konnte nicht geladen werden'}</AlertDescription>
      </Alert>
    )
  }

  const inv = dashboard.invoices

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">
            Willkommen, {dashboard.companyName}
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Ihre Projekte, Einsätze und Rechnungen im Überblick
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => router.push('/subunternehmen/rechnungen/neu')}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg hover:shadow-xl"
          >
            <Plus className="h-4 w-4 mr-2" />
            Rechnung erstellen
          </Button>
        </div>
      </div>

      {dashboard.missingForInvoicing.length > 0 && (
        <Alert className="rounded-xl bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 dark:text-amber-300">
            Für das Einreichen von Rechnungen fehlen noch Stammdaten:{' '}
            <strong>{dashboard.missingForInvoicing.join(', ')}</strong>.{' '}
            <Link href="/subunternehmen/unternehmen" className="underline font-medium">
              Jetzt vervollständigen
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {/* Eyecatcher-Banner */}
      <PortalPromoBanner />

      {/* KPI-Karten */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Building2}
          label="Laufende Projekte"
          value={dashboard.activeProjects}
          hint={`${dashboard.totalProjects} Projekte gesamt`}
          href="/subunternehmen/projekte"
        />
        <StatCard
          icon={Clock}
          label="Abrechenbare Stunden"
          value={formatHours(dashboard.billableHours)}
          hint={`${dashboard.billableAssignmentsCount} bestätigte Einsätze`}
          href="/subunternehmen/einsaetze"
        />
        <StatCard
          icon={FileText}
          label="Rechnungsentwürfe"
          value={inv.drafts}
          hint={`${inv.submitted} eingereicht · ${inv.changesRequested} Rückfragen`}
          href="/subunternehmen/rechnungen"
        />
        <StatCard
          icon={FolderOpen}
          label="Neue Dokumente"
          value={dashboard.recentDocuments.length}
          hint="Zuletzt bereitgestellt"
          href="/subunternehmen/dokumente"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Nächste Einsätze */}
        <Card className="border-0 shadow-lg bg-white dark:bg-slate-800 rounded-2xl">
          <CardHeader>
            <div className="flex items-center gap-3">
              <CalendarClock className="h-5 w-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Nächste Einsätze</h3>
            </div>
          </CardHeader>
          <CardContent>
            {dashboard.upcomingAssignments.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 py-4 text-center">
                Keine geplanten Einsätze.
              </p>
            ) : (
              <div className="space-y-3">
                {dashboard.upcomingAssignments.map((a) => (
                  <Link
                    key={a.assignmentKey}
                    href={`/subunternehmen/projekte/${a.projectId}`}
                    className="flex items-center justify-between rounded-xl border border-slate-100 dark:border-slate-700 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                        {a.projectName}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {formatDate(a.day)} · {a.count}× {a.funktion} · {a.start || '–'}–{a.ende || '–'}
                      </p>
                    </div>
                    <Badge className={`rounded-lg px-2 py-0.5 text-xs ${ASSIGNMENT_STATUS_META[a.status].className}`}>
                      {ASSIGNMENT_STATUS_META[a.status].label}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Rechnungen */}
        <Card className="border-0 shadow-lg bg-white dark:bg-slate-800 rounded-2xl">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Rechnungen</h3>
              </div>
              <Link
                href="/subunternehmen/rechnungen"
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                Alle anzeigen
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="rounded-xl bg-slate-50 dark:bg-slate-700/50 p-3 text-center">
                <p className="text-xl font-bold text-slate-900 dark:text-white">{inv.drafts}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Entwürfe</p>
              </div>
              <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 p-3 text-center">
                <p className="text-xl font-bold text-amber-700 dark:text-amber-400">{inv.changesRequested}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Rückfragen</p>
              </div>
              <div className="rounded-xl bg-green-50 dark:bg-green-900/20 p-3 text-center">
                <p className="text-xl font-bold text-green-700 dark:text-green-400">{inv.approved + inv.paid}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Freigegeben</p>
              </div>
            </div>
            {inv.recent.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 py-2 text-center">
                Noch keine Rechnungen erstellt.
              </p>
            ) : (
              <div className="space-y-2">
                {inv.recent.map((r) => {
                  const meta = INVOICE_STATUS_META[r.status as ReceivedInvoiceStatus] || INVOICE_STATUS_META.DRAFT
                  return (
                    <Link
                      key={r.id}
                      href={`/subunternehmen/rechnungen/${r.id}`}
                      className="flex items-center justify-between rounded-xl border border-slate-100 dark:border-slate-700 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-white">{r.invoiceNumber}</p>
                        {r.changeRequestMessage && (
                          <p className="text-xs text-amber-600 dark:text-amber-400 truncate">
                            Rückfrage: {r.changeRequestMessage}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-slate-600 dark:text-slate-300">{formatEuro(r.totalGross)}</span>
                        <Badge className={`rounded-lg px-2 py-0.5 text-xs ${meta.className}`}>{meta.label}</Badge>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
