"use client";
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { logger } from '@/lib/logger'
import { getErrorMessage } from '@/lib/errors'
import {
  SubPortalApi,
  type InvoiceDraftPayload,
  type PortalProjectListItem,
} from '@/lib/api/subunternehmenPortal'
import type { ReceivedInvoiceDto, SubcontractorAssignment } from '@/types/subunternehmen'
import { formatDate, formatEuro, formatHours } from '@/lib/subunternehmen/format'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
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
import { Download, Plus, Trash2 } from 'lucide-react'

type EditorLineItem = InvoiceDraftPayload['lineItems'][number] & { _key: string }

const UNITS = ['h', 'Stück', 'Tag', 'Schicht', 'km', 'pauschal'] as const
const LINE_TYPES: Array<{ id: string; label: string }> = [
  { id: 'HOURS', label: 'Stunden' },
  { id: 'EMPLOYEES', label: 'Mitarbeiter' },
  { id: 'SHIFT', label: 'Schicht' },
  { id: 'SURCHARGE', label: 'Zuschlag' },
  { id: 'QUANTITY', label: 'Menge' },
  { id: 'FLAT_RATE', label: 'Pauschale' },
  { id: 'MATERIAL', label: 'Material' },
  { id: 'TRAVEL', label: 'Fahrt' },
  { id: 'CUSTOM', label: 'Sonstiges' },
]

let keyCounter = 0
const nextKey = () => `li-${Date.now()}-${keyCounter++}`

export interface InvoiceEditorProps {
  /** Bestehender Entwurf (Bearbeitung) oder undefined (Neuanlage) */
  invoice?: ReceivedInvoiceDto
  /** Vorauswahl eines Projekts (z. B. aus dem Projektdetail) */
  initialProjectId?: string
  onSaved: (invoice: ReceivedInvoiceDto, warnings?: string[]) => void
  onCancel?: () => void
}

/**
 * Rechnungseditor: automatische Positionsübernahme aus bestätigten Einsätzen
 * plus freie Positionen. Alle Summen werden serverseitig berechnet – die
 * Anzeige hier ist eine unverbindliche Vorschau.
 */
export default function InvoiceEditor({ invoice, initialProjectId, onSaved, onCancel }: InvoiceEditorProps) {
  const [projects, setProjects] = useState<PortalProjectListItem[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState(initialProjectId || '')
  const [billable, setBillable] = useState<Array<SubcontractorAssignment & { hourlyRate?: number }>>([])
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [defaultVatRate, setDefaultVatRate] = useState(19)
  const [missingRates, setMissingRates] = useState<string[]>([])

  const [invoiceNumber, setInvoiceNumber] = useState(invoice?.invoiceNumber || '')
  const [invoiceDate, setInvoiceDate] = useState(
    invoice?.invoiceDate ? invoice.invoiceDate.slice(0, 10) : new Date().toISOString().slice(0, 10)
  )
  const [orderNumber, setOrderNumber] = useState(invoice?.orderNumber || '')
  const [purchaseOrderNumber, setPurchaseOrderNumber] = useState(invoice?.purchaseOrderNumber || '')
  const [paymentTermDays, setPaymentTermDays] = useState<string>(
    invoice?.paymentTermDays !== undefined ? String(invoice.paymentTermDays) : ''
  )
  const [remarks, setRemarks] = useState(invoice?.remarks || '')
  const [lineItems, setLineItems] = useState<EditorLineItem[]>(
    (invoice?.lineItems || []).map((li) => ({ ...li, _key: nextKey() }))
  )

  const [isSaving, setIsSaving] = useState(false)
  const [isLoadingBillable, setIsLoadingBillable] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const data = await SubPortalApi.projects()
        setProjects((data.projects || []).filter((p) => p.billableCount > 0))
      } catch (err) {
        logger.error('Portal: Projekte für Rechnung konnten nicht geladen werden', err)
      }
    }
    load()
  }, [])

  const loadBillable = useCallback(async (projectId: string) => {
    setIsLoadingBillable(true)
    try {
      const data = await SubPortalApi.invoicePrefill(projectId ? { projectId } : undefined)
      setBillable(data.assignments || [])
      setMissingRates(data.missingRates || [])
      setDefaultVatRate(data.defaultVatRate ?? 19)
      if (data.defaultPaymentTermDays !== undefined) {
        setPaymentTermDays((prev) => (prev === '' ? String(data.defaultPaymentTermDays) : prev))
      }
      setSelectedKeys(new Set())
    } catch (err) {
      logger.error('Portal: Abrechenbare Einsätze konnten nicht geladen werden', err)
    } finally {
      setIsLoadingBillable(false)
    }
  }, [])

  useEffect(() => {
    loadBillable(selectedProjectId)
  }, [selectedProjectId, loadBillable])

  const usedAssignmentKeys = useMemo(
    () => new Set(lineItems.map((li) => li.assignmentKey).filter(Boolean) as string[]),
    [lineItems]
  )

  const handleTakeover = async () => {
    if (selectedKeys.size === 0) return
    try {
      const data = await SubPortalApi.invoicePrefill({ keys: Array.from(selectedKeys) })
      const newItems: EditorLineItem[] = (data.lineItems || [])
        .filter((li) => !li.assignmentKey || !usedAssignmentKeys.has(li.assignmentKey))
        .map((li) => ({ ...li, _key: nextKey() }))
      setLineItems((prev) => [...prev, ...newItems])
      setSelectedKeys(new Set())
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }

  const addFreeItem = () => {
    setLineItems((prev) => [
      ...prev,
      {
        _key: nextKey(),
        type: 'CUSTOM',
        description: '',
        quantity: 1,
        unit: 'pauschal',
        unitPrice: 0,
        vatRate: defaultVatRate,
      },
    ])
  }

  const updateItem = (key: string, patch: Partial<EditorLineItem>) => {
    setLineItems((prev) => prev.map((li) => (li._key === key ? { ...li, ...patch } : li)))
  }

  const removeItem = (key: string) => {
    setLineItems((prev) => prev.filter((li) => li._key !== key))
  }

  // Unverbindliche Client-Vorschau (Server berechnet verbindlich)
  const preview = useMemo(() => {
    let net = 0
    let vat = 0
    for (const li of lineItems) {
      const lineNet = (Number(li.quantity) || 0) * (Number(li.unitPrice) || 0)
      net += lineNet
      vat += lineNet * ((Number(li.vatRate) || 0) / 100)
    }
    return { net, vat, gross: net + vat }
  }, [lineItems])

  const handleSave = async () => {
    setError('')
    if (lineItems.length === 0) {
      setError('Bitte mindestens eine Position hinzufügen')
      return
    }
    if (lineItems.some((li) => !li.description.trim())) {
      setError('Jede Position benötigt eine Beschreibung')
      return
    }
    setIsSaving(true)
    try {
      const payload: InvoiceDraftPayload = {
        invoiceNumber: invoiceNumber.trim() || undefined,
        invoiceDate,
        orderNumber: orderNumber.trim() || undefined,
        purchaseOrderNumber: purchaseOrderNumber.trim() || undefined,
        paymentTermDays: paymentTermDays === '' ? undefined : Math.max(0, parseInt(paymentTermDays, 10) || 0),
        remarks: remarks.trim() || undefined,
        lineItems: lineItems.map(({ _key, ...li }) => ({
          ...li,
          quantity: Number(li.quantity) || 0,
          unitPrice: Number(li.unitPrice) || 0,
          vatRate: Number(li.vatRate) || 0,
        })),
      }
      const result = invoice
        ? await SubPortalApi.updateInvoice(invoice.id, payload)
        : await SubPortalApi.createInvoice(payload)
      if (result.error) {
        setError(result.error)
        return
      }
      onSaved(result.invoice, result.warnings)
    } catch (err) {
      const msg = getErrorMessage(err)
      setError(msg)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Kopfdaten */}
      <Card className="border-0 shadow-lg bg-white dark:bg-slate-800 rounded-2xl">
        <CardHeader>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Rechnungsdaten</h3>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Rechnungsnummer</Label>
            <Input
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="leer lassen für automatische Nummer"
              className="h-11 rounded-xl font-mono"
            />
          </div>
          <div className="space-y-2">
            <Label>Rechnungsdatum</Label>
            <Input
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              className="h-11 rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label>Zahlungsziel (Tage)</Label>
            <Input
              type="number"
              min={0}
              value={paymentTermDays}
              onChange={(e) => setPaymentTermDays(e.target.value)}
              className="h-11 rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label>Auftragsnummer</Label>
            <Input
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              className="h-11 rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label>Bestellnummer</Label>
            <Input
              value={purchaseOrderNumber}
              onChange={(e) => setPurchaseOrderNumber(e.target.value)}
              className="h-11 rounded-xl"
            />
          </div>
          <div className="space-y-2 sm:col-span-2 lg:col-span-1">
            <Label>Bemerkungen</Label>
            <Input
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="h-11 rounded-xl"
            />
          </div>
        </CardContent>
      </Card>

      {/* Positionsübernahme aus bestätigten Einsätzen */}
      <Card className="border-0 shadow-lg bg-white dark:bg-slate-800 rounded-2xl">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                Bestätigte Leistungen übernehmen
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Noch nicht abgerechnete Einsätze auswählen – Stunden und Zuschläge werden automatisch übernommen
              </p>
            </div>
            <div className="flex gap-2">
              <Select value={selectedProjectId || 'alle'} onValueChange={(v) => setSelectedProjectId(v === 'alle' ? '' : v)}>
                <SelectTrigger className="h-10 rounded-xl min-w-[200px]">
                  <SelectValue placeholder="Projekt wählen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="alle">Alle Projekte</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                onClick={handleTakeover}
                disabled={selectedKeys.size === 0}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
              >
                <Download className="h-4 w-4 mr-2" />
                Übernehmen ({selectedKeys.size})
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {missingRates.length > 0 && (
            <Alert className="rounded-xl mb-4 bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800">
              <AlertDescription className="text-amber-800 dark:text-amber-300">
                Für folgende Funktionen ist noch kein Stundensatz hinterlegt:{' '}
                <strong>{missingRates.join(', ')}</strong>. Die Preise werden mit 0 € vorbelegt und
                können manuell ergänzt werden – oder die Disposition hinterlegt die Sätze in den
                Subunternehmen-Stammdaten.
              </AlertDescription>
            </Alert>
          )}
          {isLoadingBillable ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
            </div>
          ) : billable.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-6">
              Keine bestätigten, noch nicht abgerechneten Einsätze vorhanden.
            </p>
          ) : (
            <div className="overflow-x-auto max-h-72 overflow-y-auto rounded-xl border border-slate-100 dark:border-slate-700">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10" />
                    <TableHead>Datum</TableHead>
                    <TableHead>Projekt</TableHead>
                    <TableHead>Rolle</TableHead>
                    <TableHead className="text-right">MA</TableHead>
                    <TableHead className="text-right">Stunden</TableHead>
                    <TableHead className="text-right">Zuschläge</TableHead>
                    <TableHead className="text-right">Stundensatz</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {billable.map((a) => {
                    const alreadyUsed = usedAssignmentKeys.has(a.assignmentKey)
                    const surcharge = a.nachtzulageTotal + a.sonntagsstundenTotal + a.feiertagTotal + a.extraTotal
                    return (
                      <TableRow key={a.assignmentKey} className={alreadyUsed ? 'opacity-40' : ''}>
                        <TableCell>
                          <Checkbox
                            checked={selectedKeys.has(a.assignmentKey)}
                            disabled={alreadyUsed}
                            onCheckedChange={(ch) => {
                              setSelectedKeys((prev) => {
                                const next = new Set(prev)
                                if (ch) next.add(a.assignmentKey)
                                else next.delete(a.assignmentKey)
                                return next
                              })
                            }}
                          />
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{formatDate(a.day)}</TableCell>
                        <TableCell className="max-w-[220px] truncate">{a.projectName}</TableCell>
                        <TableCell>{a.funktion}</TableCell>
                        <TableCell className="text-right">{a.count}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">{formatHours(a.stundenTotal)}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          {surcharge > 0 ? formatHours(surcharge) : '–'}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          {a.hourlyRate !== undefined ? (
                            formatEuro(a.hourlyRate)
                          ) : (
                            <span className="text-amber-600 dark:text-amber-400 text-xs">kein Satz</span>
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

      {/* Positionen */}
      <Card className="border-0 shadow-lg bg-white dark:bg-slate-800 rounded-2xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              Rechnungspositionen ({lineItems.length})
            </h3>
            <Button type="button" variant="outline" onClick={addFreeItem} className="rounded-xl">
              <Plus className="h-4 w-4 mr-2" />
              Freie Position
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {lineItems.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-6">
              Noch keine Positionen. Übernehmen Sie bestätigte Leistungen oder fügen Sie freie Positionen hinzu.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[110px]">Typ</TableHead>
                    <TableHead className="min-w-[240px]">Beschreibung</TableHead>
                    <TableHead className="min-w-[90px] text-right">Menge</TableHead>
                    <TableHead className="min-w-[100px]">Einheit</TableHead>
                    <TableHead className="min-w-[110px] text-right">Einzelpreis €</TableHead>
                    <TableHead className="min-w-[80px] text-right">USt. %</TableHead>
                    <TableHead className="min-w-[100px] text-right">Netto</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lineItems.map((li) => (
                    <TableRow key={li._key}>
                      <TableCell>
                        <Select value={li.type} onValueChange={(v) => updateItem(li._key, { type: v })}>
                          <SelectTrigger className="h-9 rounded-lg text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {LINE_TYPES.map((t) => (
                              <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {li.assignmentKey && (
                          <p className="text-[10px] text-blue-500 mt-1">aus Einsatz</p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Input
                          value={li.description}
                          onChange={(e) => updateItem(li._key, { description: e.target.value })}
                          className="h-9 rounded-lg"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          value={li.quantity}
                          onChange={(e) => updateItem(li._key, { quantity: Number(e.target.value) })}
                          className="h-9 rounded-lg text-right"
                        />
                      </TableCell>
                      <TableCell>
                        <Select value={li.unit} onValueChange={(v) => updateItem(li._key, { unit: v })}>
                          <SelectTrigger className="h-9 rounded-lg text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {UNITS.map((u) => (
                              <SelectItem key={u} value={u}>{u}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          value={li.unitPrice}
                          onChange={(e) => updateItem(li._key, { unitPrice: Number(e.target.value) })}
                          className="h-9 rounded-lg text-right"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.1"
                          min={0}
                          max={100}
                          value={li.vatRate}
                          onChange={(e) => updateItem(li._key, { vatRate: Number(e.target.value) })}
                          className="h-9 rounded-lg text-right"
                        />
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap text-sm">
                        {formatEuro((Number(li.quantity) || 0) * (Number(li.unitPrice) || 0))}
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeItem(li._key)}
                          title="Position entfernen"
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Summenvorschau */}
          <div className="mt-4 flex justify-end">
            <div className="w-full sm:w-72 space-y-1 rounded-xl bg-slate-50 dark:bg-slate-700/50 p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">Netto (Vorschau)</span>
                <span className="font-medium">{formatEuro(preview.net)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">Umsatzsteuer</span>
                <span className="font-medium">{formatEuro(preview.vat)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 dark:border-slate-600 pt-1 text-base font-bold">
                <span>Brutto</span>
                <span>{formatEuro(preview.gross)}</span>
              </div>
              <p className="text-[11px] text-slate-400 pt-1">
                Verbindliche Summen werden beim Speichern serverseitig berechnet.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive" className="rounded-xl">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex gap-3">
        <Button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-12 px-8 shadow-lg hover:shadow-xl"
        >
          {isSaving ? 'Wird gespeichert…' : invoice ? 'Entwurf speichern' : 'Entwurf anlegen'}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} className="rounded-xl h-12">
            Abbrechen
          </Button>
        )}
      </div>
    </div>
  )
}
