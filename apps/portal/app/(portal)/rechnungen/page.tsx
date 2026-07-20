"use client";
import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { logger } from '@/lib/logger'
import { getErrorMessage } from '@/lib/errors'
import { SubPortalApi } from '@/lib/api/subunternehmenPortal'
import type { ReceivedInvoiceDto, ReceivedInvoiceStatus } from '@/types/subunternehmen'
import { formatDate, formatEuro, INVOICE_STATUS_META } from '@/lib/subunternehmen/format'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
import { FileText, Plus } from 'lucide-react'

const ALL = 'alle'

export default function PortalRechnungenPage() {
  const router = useRouter()
  const [invoices, setInvoices] = useState<ReceivedInvoiceDto[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState(ALL)

  useEffect(() => {
    const load = async () => {
      try {
        const data = await SubPortalApi.invoices()
        setInvoices(data.invoices || [])
      } catch (err) {
        logger.error('Portal: Rechnungen konnten nicht geladen werden', err)
        setError(getErrorMessage(err))
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [])

  const filtered = useMemo(
    () => (statusFilter === ALL ? invoices : invoices.filter((i) => i.status === statusFilter)),
    [invoices, statusFilter]
  )

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">Rechnungen</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Rechnungen erstellen, digital einreichen und den Status verfolgen
          </p>
        </div>
        <Button
          onClick={() => router.push('/rechnungen/neu')}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg hover:shadow-xl"
        >
          <Plus className="h-4 w-4 mr-2" />
          Rechnung erstellen
        </Button>
      </div>

      {error && (
        <Alert variant="destructive" className="rounded-xl">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card className="border-0 shadow-lg bg-white dark:bg-slate-800 rounded-2xl">
        <CardHeader>
          <div className="max-w-xs">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Alle Status</SelectItem>
                {(Object.keys(INVOICE_STATUS_META) as ReceivedInvoiceStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>{INVOICE_STATUS_META[s].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-10 w-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-slate-500 dark:text-slate-400 mb-4">
                {invoices.length === 0
                  ? 'Noch keine Rechnungen vorhanden.'
                  : 'Keine Rechnungen mit diesem Status.'}
              </p>
              {invoices.length === 0 && (
                <Button
                  variant="outline"
                  onClick={() => router.push('/rechnungen/neu')}
                  className="rounded-xl"
                >
                  Erste Rechnung erstellen
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rechnungsnummer</TableHead>
                    <TableHead>Rechnungsdatum</TableHead>
                    <TableHead>Leistungszeitraum</TableHead>
                    <TableHead className="text-right">Netto</TableHead>
                    <TableHead className="text-right">Brutto</TableHead>
                    <TableHead>Fälligkeit</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Hinweise</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((inv) => {
                    const meta = INVOICE_STATUS_META[inv.status]
                    return (
                      <TableRow key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                        <TableCell>
                          <Link
                            href={`/rechnungen/${inv.id}`}
                            className="font-mono font-medium text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            {inv.invoiceNumber}
                            {inv.version > 1 ? ` (Rev. ${inv.version})` : ''}
                          </Link>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{formatDate(inv.invoiceDate)}</TableCell>
                        <TableCell className="whitespace-nowrap text-sm">
                          {inv.servicePeriodStart
                            ? `${formatDate(inv.servicePeriodStart)} – ${formatDate(inv.servicePeriodEnd)}`
                            : '–'}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">{formatEuro(inv.subtotalNet)}</TableCell>
                        <TableCell className="text-right whitespace-nowrap font-medium">
                          {formatEuro(inv.totalGross)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{formatDate(inv.dueDate)}</TableCell>
                        <TableCell>
                          <Badge className={`rounded-lg px-2 py-0.5 text-xs ${meta.className}`}>{meta.label}</Badge>
                        </TableCell>
                        <TableCell className="text-xs max-w-[220px]">
                          {inv.status === 'CHANGES_REQUESTED' && inv.changeRequestMessage ? (
                            <span className="text-amber-600 dark:text-amber-400">{inv.changeRequestMessage}</span>
                          ) : inv.status === 'REJECTED' && inv.rejectionReason ? (
                            <span className="text-red-600 dark:text-red-400">{inv.rejectionReason}</span>
                          ) : inv.warnings && inv.warnings.length > 0 ? (
                            <span className="text-amber-600 dark:text-amber-400">
                              {inv.warnings.length} Hinweis(e)
                            </span>
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
    </div>
  )
}
