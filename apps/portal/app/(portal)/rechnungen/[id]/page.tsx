"use client";
import React, { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { logger } from '@/lib/logger'
import { getErrorMessage } from '@/lib/errors'
import { SubPortalApi } from '@/lib/api/subunternehmenPortal'
import type { ReceivedInvoiceDto } from '@/types/subunternehmen'
import { formatDate, formatEuro, INVOICE_STATUS_META } from '@/lib/subunternehmen/format'
import InvoiceEditor from '@/components/subunternehmen/InvoiceEditor'
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
import {
  AlertTriangle,
  ArrowLeft,
  Download,
  History,
  Pencil,
  RefreshCw,
  Send,
  Trash2,
} from 'lucide-react'

export default function PortalRechnungDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [invoice, setInvoice] = useState<ReceivedInvoiceDto | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [isActing, setIsActing] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    try {
      const data = await SubPortalApi.invoice(String(params.id))
      setInvoice(data.invoice)
    } catch (err) {
      logger.error('Portal: Rechnung konnte nicht geladen werden', err)
      setError(getErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }, [params?.id])

  useEffect(() => {
    if (params?.id) load()
  }, [params?.id, load])

  const handleSubmit = async () => {
    if (!invoice) return
    if (!confirm(`Rechnung ${invoice.invoiceNumber} verbindlich einreichen? Eingereichte Rechnungen können nicht mehr bearbeitet werden.`)) return
    setIsActing(true)
    setError('')
    try {
      const result = await SubPortalApi.submitInvoice(invoice.id)
      if (result.error) {
        setError(result.error)
        return
      }
      setInvoice(result.invoice)
      setNotice('Rechnung wurde eingereicht und als PDF übermittelt.')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setIsActing(false)
    }
  }

  const handleDelete = async () => {
    if (!invoice) return
    if (!confirm(`Entwurf ${invoice.invoiceNumber} wirklich löschen?`)) return
    setIsActing(true)
    try {
      const result = await SubPortalApi.deleteInvoice(invoice.id)
      if (result.error) {
        setError(result.error)
        return
      }
      router.push('/rechnungen')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setIsActing(false)
    }
  }

  const handleRevision = async () => {
    if (!invoice) return
    setIsActing(true)
    setError('')
    try {
      const result = await SubPortalApi.reviseInvoice(invoice.id)
      if (result.error) {
        setError(result.error)
        return
      }
      setInvoice(result.invoice)
      setIsEditing(true)
      setNotice(`Revision ${result.invoice.version} erstellt – der Entwurf kann jetzt bearbeitet werden.`)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setIsActing(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (error && !invoice) {
    return (
      <div className="max-w-xl space-y-4">
        <Alert variant="destructive" className="rounded-xl">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button variant="outline" onClick={() => router.push('/rechnungen')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Zurück zu Rechnungen
        </Button>
      </div>
    )
  }

  if (!invoice) return null

  const meta = INVOICE_STATUS_META[invoice.status]
  const isDraft = invoice.status === 'DRAFT'
  const canRevise = invoice.status === 'CHANGES_REQUESTED'
  const hasPdf = Boolean(invoice.generatedPdfDocumentId)

  if (isEditing && isDraft) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto">
        <div>
          <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)} className="mb-2 -ml-2 text-slate-500">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Zurück zur Ansicht
          </Button>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">
            {invoice.invoiceNumber} bearbeiten
          </h1>
        </div>
        <InvoiceEditor
          invoice={invoice}
          onSaved={(updated) => {
            setInvoice(updated)
            setIsEditing(false)
            setNotice('Entwurf gespeichert.')
          }}
          onCancel={() => setIsEditing(false)}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/rechnungen')}
            className="mb-2 -ml-2 text-slate-500"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Rechnungen
          </Button>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white font-mono">
              {invoice.invoiceNumber}
            </h1>
            {invoice.version > 1 && (
              <Badge className="rounded-lg bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                Revision {invoice.version}
              </Badge>
            )}
            <Badge className={`rounded-lg px-3 py-1 ${meta.className}`}>{meta.label}</Badge>
          </div>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Rechnungsdatum {formatDate(invoice.invoiceDate)}
            {invoice.dueDate ? ` · fällig am ${formatDate(invoice.dueDate)}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {hasPdf && (
            <Button variant="outline" asChild className="rounded-xl">
              <a href={`/api/subunternehmen/invoices/${invoice.id}/pdf`}>
                <Download className="h-4 w-4 mr-2" />
                PDF
              </a>
            </Button>
          )}
          {isDraft && (
            <>
              <Button variant="outline" onClick={() => setIsEditing(true)} className="rounded-xl">
                <Pencil className="h-4 w-4 mr-2" />
                Bearbeiten
              </Button>
              <Button variant="outline" onClick={handleDelete} disabled={isActing} className="rounded-xl text-red-600">
                <Trash2 className="h-4 w-4 mr-2" />
                Löschen
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isActing}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg"
              >
                <Send className="h-4 w-4 mr-2" />
                {isActing ? 'Wird eingereicht…' : 'Einreichen'}
              </Button>
            </>
          )}
          {canRevise && (
            <Button
              onClick={handleRevision}
              disabled={isActing}
              className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-lg"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Revision erstellen
            </Button>
          )}
        </div>
      </div>

      {notice && (
        <Alert className="rounded-xl bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800">
          <AlertDescription className="text-green-800 dark:text-green-300">{notice}</AlertDescription>
        </Alert>
      )}
      {error && (
        <Alert variant="destructive" className="rounded-xl">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {invoice.status === 'CHANGES_REQUESTED' && invoice.changeRequestMessage && (
        <Alert className="rounded-xl bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 dark:text-amber-300">
            <strong>Rückfrage:</strong> {invoice.changeRequestMessage}
          </AlertDescription>
        </Alert>
      )}
      {invoice.status === 'REJECTED' && invoice.rejectionReason && (
        <Alert variant="destructive" className="rounded-xl">
          <AlertDescription>
            <strong>Ablehnungsgrund:</strong> {invoice.rejectionReason}
          </AlertDescription>
        </Alert>
      )}
      {invoice.warnings && invoice.warnings.length > 0 && (
        <Alert className="rounded-xl bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 dark:text-amber-300">
            <strong>Hinweise:</strong>
            <ul className="list-disc pl-4 mt-1 text-sm">
              {invoice.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Positionen */}
      <Card className="border-0 shadow-lg bg-white dark:bg-slate-800 rounded-2xl">
        <CardHeader>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Positionen ({invoice.lineItems.length})
          </h3>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pos.</TableHead>
                  <TableHead>Beschreibung</TableHead>
                  <TableHead>Leistungsdatum</TableHead>
                  <TableHead className="text-right">Menge</TableHead>
                  <TableHead className="text-right">Einzelpreis</TableHead>
                  <TableHead className="text-right">USt.</TableHead>
                  <TableHead className="text-right">Netto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoice.lineItems.map((li, idx) => (
                  <TableRow key={li.id}>
                    <TableCell>{idx + 1}</TableCell>
                    <TableCell className="max-w-[320px]">
                      {li.description}
                      {li.assignmentKey && (
                        <span className="block text-[10px] text-blue-500">aus bestätigtem Einsatz</span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{li.serviceDate ? formatDate(li.serviceDate) : '–'}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {li.quantity.toLocaleString('de-DE')} {li.unit}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">{formatEuro(li.unitPrice)}</TableCell>
                    <TableCell className="text-right">{li.vatRate} %</TableCell>
                    <TableCell className="text-right whitespace-nowrap">{formatEuro(li.netAmount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 flex justify-end">
            <div className="w-full sm:w-72 space-y-1 rounded-xl bg-slate-50 dark:bg-slate-700/50 p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">Netto</span>
                <span className="font-medium">{formatEuro(invoice.subtotalNet)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">Umsatzsteuer</span>
                <span className="font-medium">{formatEuro(invoice.totalVat)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 dark:border-slate-600 pt-1 text-base font-bold">
                <span>Brutto</span>
                <span>{formatEuro(invoice.totalGross)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statushistorie */}
      <Card className="border-0 shadow-lg bg-white dark:bg-slate-800 rounded-2xl">
        <CardHeader>
          <div className="flex items-center gap-3">
            <History className="h-5 w-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Statusverlauf</h3>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...invoice.statusHistory].reverse().map((h) => {
              const hMeta = INVOICE_STATUS_META[h.newStatus]
              return (
                <div key={h.id} className="flex items-start gap-3">
                  <Badge className={`rounded-lg px-2 py-0.5 text-xs mt-0.5 ${hMeta.className}`}>
                    {hMeta.label}
                  </Badge>
                  <div className="min-w-0 text-sm">
                    <p className="text-slate-700 dark:text-slate-300">
                      {new Date(h.changedAt).toLocaleString('de-DE')}
                      {h.changedByName ? ` · ${h.changedByName}` : ''}
                    </p>
                    {h.message && <p className="text-slate-500 dark:text-slate-400">{h.message}</p>}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
