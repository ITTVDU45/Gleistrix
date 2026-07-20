"use client";
import React, { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { logger } from '@/lib/logger'
import { getErrorMessage } from '@/lib/errors'
import {
  ReceivedInvoicesApi,
  type AdminReceivedInvoice,
  type ReceivedInvoiceFilters,
} from '@/lib/api/receivedInvoices'
import { useSubcompanies } from '@/hooks/useSubcompanies'
import { formatDate, formatEuro, INVOICE_STATUS_META } from '@/lib/subunternehmen/format'
import type { ReceivedInvoiceStatus } from '@/types/subunternehmen'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ChevronLeft, ChevronRight, FileText, FilterX, RefreshCw } from 'lucide-react'

const ALL = 'alle'
const ADMIN_STATUSES: ReceivedInvoiceStatus[] = [
  'SUBMITTED', 'UNDER_REVIEW', 'CHANGES_REQUESTED', 'APPROVED',
  'REJECTED', 'SCHEDULED_FOR_PAYMENT', 'PAID', 'CANCELLED',
]

/** Interner Bereich: Übersicht der von Subunternehmen eingereichten Rechnungen. */
export default function ReceivedInvoicesAdmin() {
  const { subcompanies } = useSubcompanies()
  const [invoices, setInvoices] = useState<AdminReceivedInvoice[]>([])
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 25 })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  const [statusFilter, setStatusFilter] = useState(ALL)
  const [companyFilter, setCompanyFilter] = useState(ALL)
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError('')
    try {
      const filters: ReceivedInvoiceFilters = {
        page,
        limit: 25,
        ...(statusFilter !== ALL ? { status: statusFilter } : {}),
        ...(companyFilter !== ALL ? { companyId: companyFilter } : {}),
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(dateFrom ? { dateFrom } : {}),
        ...(dateTo ? { dateTo } : {}),
      }
      const data = await ReceivedInvoicesApi.list(filters)
      setInvoices(data.invoices || [])
      setMeta(data.meta || { total: 0, page: 1, limit: 25 })
    } catch (err) {
      logger.error('Erhaltene Rechnungen konnten nicht geladen werden', err)
      setError(getErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }, [page, statusFilter, companyFilter, search, dateFrom, dateTo])

  useEffect(() => {
    load()
  }, [load])

  const totalPages = Math.max(1, Math.ceil(meta.total / meta.limit))

  const resetFilters = () => {
    setStatusFilter(ALL)
    setCompanyFilter(ALL)
    setSearch('')
    setDateFrom('')
    setDateTo('')
    setPage(1)
  }

  return (
    <Card className="border-0 shadow-lg bg-white dark:bg-slate-800 rounded-2xl">
      <CardHeader>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Erhaltene Rechnungen</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Digital eingereichte Rechnungen der Subunternehmen prüfen und freigeben
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={load} className="rounded-lg">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1) }}>
              <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Alle Status</SelectItem>
                {ADMIN_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{INVOICE_STATUS_META[s].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={companyFilter} onValueChange={(v) => { setCompanyFilter(v); setPage(1) }}>
              <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="Subunternehmen" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Alle Subunternehmen</SelectItem>
                {subcompanies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Rechnungsnummer…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="h-10 rounded-xl"
            />
            <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1) }} className="h-10 rounded-xl" />
            <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1) }} className="h-10 rounded-xl" />
            <Button variant="outline" onClick={resetFilters} className="h-10 rounded-xl">
              <FilterX className="h-4 w-4 mr-2" />
              Zurücksetzen
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="rounded-xl mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : invoices.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="h-10 w-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-slate-500 dark:text-slate-400">Keine Rechnungen gefunden.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rechnungsnummer</TableHead>
                    <TableHead>Subunternehmen</TableHead>
                    <TableHead>Rechnungsdatum</TableHead>
                    <TableHead>Eingang</TableHead>
                    <TableHead className="text-right">Netto</TableHead>
                    <TableHead className="text-right">USt.</TableHead>
                    <TableHead className="text-right">Brutto</TableHead>
                    <TableHead>Fälligkeit</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((inv) => {
                    const statusMeta = INVOICE_STATUS_META[inv.status]
                    return (
                      <TableRow key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                        <TableCell>
                          <Link
                            href={`/abbrechnung/erhaltene/${inv.id}`}
                            className="font-mono font-medium text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            {inv.invoiceNumber}
                            {inv.version > 1 ? ` (Rev. ${inv.version})` : ''}
                          </Link>
                        </TableCell>
                        <TableCell>{inv.subcontractorCompanyName || '–'}</TableCell>
                        <TableCell className="whitespace-nowrap">{formatDate(inv.invoiceDate)}</TableCell>
                        <TableCell className="whitespace-nowrap">{formatDate(inv.submittedAt)}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">{formatEuro(inv.subtotalNet)}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">{formatEuro(inv.totalVat)}</TableCell>
                        <TableCell className="text-right whitespace-nowrap font-medium">{formatEuro(inv.totalGross)}</TableCell>
                        <TableCell className="whitespace-nowrap">{formatDate(inv.dueDate)}</TableCell>
                        <TableCell>
                          <Badge className={`rounded-lg px-2 py-0.5 text-xs ${statusMeta.className}`}>
                            {statusMeta.label}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
            <div className="flex items-center justify-between mt-4 text-sm text-slate-500 dark:text-slate-400">
              <span>{meta.total} Rechnungen</span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="rounded-lg"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span>Seite {meta.page} / {totalPages}</span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-lg"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
