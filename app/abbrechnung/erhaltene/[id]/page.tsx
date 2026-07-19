"use client";
import React, { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { logger } from '@/lib/logger'
import { getErrorMessage } from '@/lib/errors'
import {
  ReceivedInvoicesApi,
  type ReceivedInvoiceAction,
  type ReceivedInvoiceDetail,
} from '@/lib/api/receivedInvoices'
import {
  ASSIGNMENT_STATUS_META,
  formatDate,
  formatEuro,
  formatHours,
  INVOICE_STATUS_META,
} from '@/lib/subunternehmen/format'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
  Banknote,
  Check,
  Download,
  History,
  MessageSquare,
  Search,
  StickyNote,
  X,
} from 'lucide-react'

interface PendingAction {
  action: ReceivedInvoiceAction
  title: string
  description: string
  needsMessage: boolean
}

const ACTION_CONFIG: Record<ReceivedInvoiceAction, Omit<PendingAction, 'action'>> = {
  START_REVIEW: {
    title: 'Prüfung starten',
    description: 'Die Rechnung wird in den Status „In Prüfung“ versetzt.',
    needsMessage: false,
  },
  REQUEST_CHANGES: {
    title: 'Rückfrage senden',
    description: 'Das Subunternehmen erhält Ihre Rückfrage und kann eine Revision einreichen.',
    needsMessage: true,
  },
  REJECT: {
    title: 'Rechnung ablehnen',
    description: 'Die Ablehnung ist endgültig und muss begründet werden.',
    needsMessage: true,
  },
  APPROVE: {
    title: 'Rechnung freigeben',
    description: 'Die Rechnung wird zur Zahlung freigegeben.',
    needsMessage: false,
  },
  SCHEDULE_PAYMENT: {
    title: 'Zur Zahlung vormerken',
    description: 'Die Rechnung wird für den Zahllauf vorgesehen.',
    needsMessage: false,
  },
  MARK_PAID: {
    title: 'Als bezahlt markieren',
    description: 'Die Zahlung wird als erfolgt dokumentiert.',
    needsMessage: false,
  },
}

export default function ReceivedInvoiceDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [detail, setDetail] = useState<ReceivedInvoiceDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [pending, setPending] = useState<PendingAction | null>(null)
  const [actionMessage, setActionMessage] = useState('')
  const [isActing, setIsActing] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [isSavingNote, setIsSavingNote] = useState(false)

  const load = useCallback(async () => {
    try {
      const data = await ReceivedInvoicesApi.detail(String(params.id))
      setDetail(data)
    } catch (err) {
      logger.error('Erhaltene Rechnung konnte nicht geladen werden', err)
      setError(getErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }, [params?.id])

  useEffect(() => {
    if (params?.id) load()
  }, [params?.id, load])

  const openAction = (action: ReceivedInvoiceAction) => {
    setActionMessage('')
    setActionError('')
    setPending({ action, ...ACTION_CONFIG[action] })
  }

  const executeAction = async () => {
    if (!pending || !detail) return
    if (pending.needsMessage && !actionMessage.trim()) {
      setActionError('Bitte eine Begründung/Nachricht eingeben')
      return
    }
    setIsActing(true)
    setActionError('')
    try {
      const result = await ReceivedInvoicesApi.changeStatus(
        detail.invoice.id,
        pending.action,
        actionMessage.trim() || undefined
      )
      if (result.error) {
        setActionError(result.error)
        return
      }
      setPending(null)
      await load()
    } catch (err) {
      setActionError(getErrorMessage(err))
    } finally {
      setIsActing(false)
    }
  }

  const saveNote = async () => {
    if (!detail || !noteText.trim()) return
    setIsSavingNote(true)
    try {
      await ReceivedInvoicesApi.addNote(detail.invoice.id, noteText.trim())
      setNoteText('')
      await load()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setIsSavingNote(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (error || !detail) {
    return (
      <div className="max-w-xl space-y-4 p-6">
        <Alert variant="destructive" className="rounded-xl">
          <AlertDescription>{error || 'Rechnung nicht gefunden'}</AlertDescription>
        </Alert>
        <Button variant="outline" onClick={() => router.push('/abbrechnung')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Zurück zur Abrechnung
        </Button>
      </div>
    )
  }

  const { invoice, company, documents, comparison } = detail
  const statusMeta = INVOICE_STATUS_META[invoice.status]
  const status = invoice.status
  const availableActions: ReceivedInvoiceAction[] = []
  if (status === 'SUBMITTED') availableActions.push('START_REVIEW', 'REQUEST_CHANGES', 'APPROVE', 'REJECT')
  if (status === 'UNDER_REVIEW') availableActions.push('REQUEST_CHANGES', 'APPROVE', 'REJECT')
  if (status === 'CHANGES_REQUESTED') availableActions.push('REJECT')
  if (status === 'APPROVED') availableActions.push('SCHEDULE_PAYMENT', 'MARK_PAID')
  if (status === 'SCHEDULED_FOR_PAYMENT') availableActions.push('MARK_PAID')

  const actionIcon: Record<ReceivedInvoiceAction, React.ReactNode> = {
    START_REVIEW: <Search className="h-4 w-4 mr-2" />,
    REQUEST_CHANGES: <MessageSquare className="h-4 w-4 mr-2" />,
    REJECT: <X className="h-4 w-4 mr-2" />,
    APPROVE: <Check className="h-4 w-4 mr-2" />,
    SCHEDULE_PAYMENT: <Banknote className="h-4 w-4 mr-2" />,
    MARK_PAID: <Banknote className="h-4 w-4 mr-2" />,
  }
  const actionStyle: Record<ReceivedInvoiceAction, string> = {
    START_REVIEW: 'bg-indigo-600 hover:bg-indigo-700 text-white',
    REQUEST_CHANGES: 'bg-amber-600 hover:bg-amber-700 text-white',
    REJECT: 'bg-red-600 hover:bg-red-700 text-white',
    APPROVE: 'bg-green-600 hover:bg-green-700 text-white',
    SCHEDULE_PAYMENT: 'bg-teal-600 hover:bg-teal-700 text-white',
    MARK_PAID: 'bg-emerald-600 hover:bg-emerald-700 text-white',
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-6">
      {/* Kopf */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/abbrechnung')}
            className="mb-2 -ml-2 text-slate-500"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Erhaltene Rechnungen
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
            <Badge className={`rounded-lg px-3 py-1 ${statusMeta.className}`}>{statusMeta.label}</Badge>
          </div>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            {invoice.subcontractorCompanyName || (company?.name as string) || 'Subunternehmen'} ·
            eingereicht am {formatDate(invoice.submittedAt)} · Rechnungsdatum {formatDate(invoice.invoiceDate)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {availableActions.map((action) => (
            <Button
              key={action}
              onClick={() => openAction(action)}
              className={`rounded-xl shadow ${actionStyle[action]}`}
            >
              {actionIcon[action]}
              {ACTION_CONFIG[action].title}
            </Button>
          ))}
        </div>
      </div>

      {comparison.deviations.length > 0 && (
        <Alert className="rounded-xl bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 dark:text-amber-300">
            <strong>Erkannte Abweichungen:</strong>
            <ul className="list-disc pl-4 mt-1 text-sm">
              {comparison.deviations.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* Rechnungsbereich */}
        <div className="xl:col-span-3 space-y-6">
          <Card className="border-0 shadow-lg bg-white dark:bg-slate-800 rounded-2xl">
            <CardHeader>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                Rechnungspositionen ({invoice.lineItems.length})
              </h3>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pos.</TableHead>
                      <TableHead>Beschreibung</TableHead>
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
                        <TableCell className="max-w-[300px]">
                          {li.description}
                          {li.assignmentKey && (
                            <span className="block text-[10px] text-blue-500">aus bestätigtem Einsatz</span>
                          )}
                        </TableCell>
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
                  {invoice.dueDate && (
                    <p className="text-xs text-slate-500 pt-1">Fällig am {formatDate(invoice.dueDate)}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Vergleichsbereich */}
          <Card className="border-0 shadow-lg bg-white dark:bg-slate-800 rounded-2xl">
            <CardHeader>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                Vergleich: Disponierte Einsätze
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Einsätze des Subunternehmens in den verknüpften Projekten
              </p>
            </CardHeader>
            <CardContent>
              {comparison.assignments.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-6">
                  Keine disponierten Einsätze zu den verknüpften Projekten gefunden.
                </p>
              ) : (
                <div className="overflow-x-auto max-h-96 overflow-y-auto rounded-xl border border-slate-100 dark:border-slate-700">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Datum</TableHead>
                        <TableHead>Projekt</TableHead>
                        <TableHead>Rolle</TableHead>
                        <TableHead className="text-right">MA</TableHead>
                        <TableHead className="text-right">Std.</TableHead>
                        <TableHead className="text-right">Zuschläge</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>In Rechnung</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {comparison.assignments.map((a) => {
                        const aMeta = ASSIGNMENT_STATUS_META[a.status]
                        const surcharge =
                          a.nachtzulageTotal + a.sonntagsstundenTotal + a.feiertagTotal + a.extraTotal
                        return (
                          <TableRow key={a.assignmentKey}>
                            <TableCell className="whitespace-nowrap">{formatDate(a.day)}</TableCell>
                            <TableCell className="max-w-[180px] truncate">{a.projectName}</TableCell>
                            <TableCell>{a.funktion}</TableCell>
                            <TableCell className="text-right">{a.count}</TableCell>
                            <TableCell className="text-right whitespace-nowrap">{formatHours(a.stundenTotal)}</TableCell>
                            <TableCell className="text-right whitespace-nowrap">
                              {surcharge > 0 ? formatHours(surcharge) : '–'}
                            </TableCell>
                            <TableCell>
                              <Badge className={`rounded-lg px-2 py-0.5 text-xs ${aMeta.className}`}>{aMeta.label}</Badge>
                            </TableCell>
                            <TableCell>
                              {a.referencedInInvoice ? (
                                <Check className="h-4 w-4 text-green-600" />
                              ) : (
                                <span className="text-slate-400 text-sm">–</span>
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

        {/* Seitenleiste */}
        <div className="xl:col-span-2 space-y-6">
          {/* Rechnungssteller */}
          <Card className="border-0 shadow-lg bg-white dark:bg-slate-800 rounded-2xl">
            <CardHeader>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Rechnungssteller</h3>
            </CardHeader>
            <CardContent className="text-sm space-y-1 text-slate-700 dark:text-slate-300">
              <p className="font-medium">{(company?.legalName as string) || (company?.name as string) || '–'}</p>
              {company?.billingAddress ? (
                <p>
                  {(company.billingAddress as Record<string, string>).street}<br />
                  {(company.billingAddress as Record<string, string>).postalCode}{' '}
                  {(company.billingAddress as Record<string, string>).city}
                </p>
              ) : null}
              <div className="pt-2 space-y-1 text-xs text-slate-500 dark:text-slate-400">
                {company?.iban ? <p>IBAN: <span className="font-mono">{String(company.iban)}</span></p> : null}
                {company?.bic ? <p>BIC: <span className="font-mono">{String(company.bic)}</span></p> : null}
                {company?.bankName ? <p>Bank: {String(company.bankName)}</p> : null}
                {company?.taxNumber ? <p>Steuernummer: {String(company.taxNumber)}</p> : null}
                {company?.vatId ? <p>USt-ID: {String(company.vatId)}</p> : null}
              </div>
            </CardContent>
          </Card>

          {/* Dokumente */}
          <Card className="border-0 shadow-lg bg-white dark:bg-slate-800 rounded-2xl">
            <CardHeader>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Dokumente</h3>
            </CardHeader>
            <CardContent>
              {documents.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">Keine Dokumente vorhanden.</p>
              ) : (
                <div className="space-y-2">
                  {documents.map((d) => (
                    <a
                      key={d.id}
                      href={ReceivedInvoicesApi.documentUrl(invoice.id, d.id)}
                      className="flex items-center justify-between rounded-xl border border-slate-100 dark:border-slate-700 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{d.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {d.type === 'INVOICE_PDF' ? 'Rechnungs-PDF' : d.type} · {formatDate(d.createdAt)}
                        </p>
                      </div>
                      <Download className="h-4 w-4 text-blue-600 shrink-0" />
                    </a>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Interne Notizen */}
          <Card className="border-0 shadow-lg bg-white dark:bg-slate-800 rounded-2xl">
            <CardHeader>
              <div className="flex items-center gap-2">
                <StickyNote className="h-5 w-5 text-amber-500" />
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Interne Notizen</h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Nur intern sichtbar – niemals im Subunternehmen-Portal
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {(invoice.internalNotes || []).length > 0 && (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {(invoice.internalNotes || []).map((n) => (
                    <div key={n.id} className="rounded-xl bg-amber-50 dark:bg-amber-900/20 p-3 text-sm">
                      <p className="text-slate-800 dark:text-slate-200">{n.text}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {n.createdByName || 'Unbekannt'} · {n.createdAt ? new Date(n.createdAt).toLocaleString('de-DE') : ''}
                      </p>
                    </div>
                  ))}
                </div>
              )}
              <Textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Interne Notiz hinzufügen…"
                className="rounded-xl min-h-[70px]"
              />
              <Button
                onClick={saveNote}
                disabled={isSavingNote || !noteText.trim()}
                variant="outline"
                className="rounded-xl w-full"
              >
                {isSavingNote ? 'Wird gespeichert…' : 'Notiz speichern'}
              </Button>
            </CardContent>
          </Card>

          {/* Statushistorie */}
          <Card className="border-0 shadow-lg bg-white dark:bg-slate-800 rounded-2xl">
            <CardHeader>
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Statusverlauf</h3>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {[...invoice.statusHistory].reverse().map((h) => {
                  const hMeta = INVOICE_STATUS_META[h.newStatus]
                  return (
                    <div key={h.id} className="flex items-start gap-3">
                      <Badge className={`rounded-lg px-2 py-0.5 text-xs mt-0.5 ${hMeta.className}`}>{hMeta.label}</Badge>
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
      </div>

      {/* Aktions-Dialog */}
      <Dialog open={Boolean(pending)} onOpenChange={(open) => !open && setPending(null)}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>{pending?.title}</DialogTitle>
            <DialogDescription>{pending?.description}</DialogDescription>
          </DialogHeader>
          {pending?.needsMessage && (
            <Textarea
              value={actionMessage}
              onChange={(e) => setActionMessage(e.target.value)}
              placeholder={pending.action === 'REJECT' ? 'Ablehnungsgrund…' : 'Nachricht an das Subunternehmen…'}
              className="rounded-xl min-h-[90px]"
            />
          )}
          {actionError && (
            <Alert variant="destructive" className="rounded-xl">
              <AlertDescription>{actionError}</AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPending(null)} className="rounded-xl">
              Abbrechen
            </Button>
            <Button
              onClick={executeAction}
              disabled={isActing}
              className={`rounded-xl ${pending ? actionStyle[pending.action] : ''}`}
            >
              {isActing ? 'Wird ausgeführt…' : pending?.title}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
