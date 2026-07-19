"use client";
import React, { useEffect, useState } from 'react'
import { logger } from '@/lib/logger'
import { getErrorMessage } from '@/lib/errors'
import { SubPortalApi, type PortalCompany } from '@/lib/api/subunternehmenPortal'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { formatEuro } from '@/lib/subunternehmen/format'
import { AlertTriangle, Building2, Check, Coins, Landmark, Receipt } from 'lucide-react'

type EditableCompany = Omit<
  PortalCompany,
  'id' | 'name' | 'employeeCount' | 'status' | 'address' | 'phone' | 'email' | 'functionRates' | 'surchargeRates'
>

export default function PortalUnternehmenPage() {
  const [company, setCompany] = useState<PortalCompany | null>(null)
  const [missing, setMissing] = useState<string[]>([])
  const [canEdit, setCanEdit] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const data = await SubPortalApi.company()
        setCompany(data.company)
        setMissing(data.missingForInvoicing || [])
        setCanEdit((data.permissions || []).includes('subcontractor.company.update'))
      } catch (err) {
        logger.error('Portal: Unternehmensprofil konnte nicht geladen werden', err)
        setError(getErrorMessage(err))
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [])

  const update = (patch: Partial<PortalCompany>) =>
    setCompany((prev) => (prev ? { ...prev, ...patch } : prev))

  const updateAddress = (patch: Partial<PortalCompany['billingAddress']>) =>
    setCompany((prev) =>
      prev ? { ...prev, billingAddress: { ...prev.billingAddress, ...patch } } : prev
    )

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!company) return
    setIsSaving(true)
    setError('')
    setSuccess('')
    try {
      const payload: EditableCompany = {
        legalName: company.legalName,
        billingAddress: company.billingAddress,
        contactName: company.contactName,
        contactEmail: company.contactEmail,
        contactPhone: company.contactPhone,
        taxNumber: company.taxNumber,
        vatId: company.vatId,
        iban: company.iban,
        bic: company.bic,
        bankName: company.bankName,
        defaultPaymentTermDays: company.defaultPaymentTermDays,
        defaultVatRate: company.defaultVatRate,
        invoiceNumberPrefix: company.invoiceNumberPrefix,
      }
      const result = await SubPortalApi.updateCompany(payload)
      if (result.error) {
        setError(result.error)
        return
      }
      setCompany(result.company)
      setMissing(result.missingForInvoicing || [])
      setSuccess('Unternehmensdaten gespeichert')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (!company) {
    return (
      <Alert variant="destructive" className="rounded-xl max-w-xl">
        <AlertDescription>{error || 'Unternehmensdaten konnten nicht geladen werden'}</AlertDescription>
      </Alert>
    )
  }

  const numberInput = (value: number | undefined, onChange: (v: number | undefined) => void) => (
    <Input
      type="number"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
      className="h-11 rounded-xl"
      disabled={!canEdit}
    />
  )

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">Unternehmensprofil</h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">
          Stammdaten für Rechnungen und Kommunikation – {company.name}
        </p>
      </div>

      {missing.length > 0 ? (
        <Alert className="rounded-xl bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 dark:text-amber-300">
            Vor dem Einreichen einer Rechnung bitte ergänzen: <strong>{missing.join(', ')}</strong>
          </AlertDescription>
        </Alert>
      ) : (
        <Alert className="rounded-xl bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800">
          <Check className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800 dark:text-green-300">
            Alle Pflichtangaben für die Rechnungsstellung sind vorhanden.
          </AlertDescription>
        </Alert>
      )}

      {!canEdit && (
        <Alert className="rounded-xl">
          <AlertDescription>
            Sie haben keine Berechtigung, die Unternehmensdaten zu bearbeiten. Wenden Sie sich an den
            Inhaber-Zugang Ihres Unternehmens.
          </AlertDescription>
        </Alert>
      )}

      {/* Vereinbarte Stundensätze (nur lesend – Pflege durch die Disposition) */}
      {(company.functionRates.length > 0 ||
        company.surchargeRates.nachtProzent !== undefined ||
        company.surchargeRates.sonntagProzent !== undefined ||
        company.surchargeRates.feiertagProzent !== undefined) && (
        <Card className="border-0 shadow-lg bg-white dark:bg-slate-800 rounded-2xl">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Coins className="h-5 w-5 text-blue-600" />
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Vereinbarte Stundensätze</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Grundlage der automatischen Rechnungsvorschläge – Änderungen bitte über Ihre Disposition
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {company.functionRates.map((rate) => (
                <div
                  key={rate.funktion}
                  className="flex items-center justify-between rounded-xl bg-slate-50 dark:bg-slate-700/50 px-3 py-2 text-sm"
                >
                  <span className="text-slate-700 dark:text-slate-300 truncate pr-2">{rate.funktion}</span>
                  <span className="font-medium whitespace-nowrap">{formatEuro(rate.hourlyRate)}/h</span>
                </div>
              ))}
            </div>
            {(company.surchargeRates.nachtProzent !== undefined ||
              company.surchargeRates.sonntagProzent !== undefined ||
              company.surchargeRates.feiertagProzent !== undefined) && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">
                Zuschläge auf den Stundensatz:{' '}
                {[
                  company.surchargeRates.nachtProzent !== undefined ? `Nacht ${company.surchargeRates.nachtProzent} %` : null,
                  company.surchargeRates.sonntagProzent !== undefined ? `Sonntag ${company.surchargeRates.sonntagProzent} %` : null,
                  company.surchargeRates.feiertagProzent !== undefined ? `Feiertag ${company.surchargeRates.feiertagProzent} %` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Firma */}
        <Card className="border-0 shadow-lg bg-white dark:bg-slate-800 rounded-2xl">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Unternehmen</h3>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Unternehmensname</Label>
              <Input value={company.name} className="h-11 rounded-xl bg-slate-50 dark:bg-slate-700" disabled />
              <p className="text-xs text-slate-400">Wird von der Disposition verwaltet</p>
            </div>
            <div className="space-y-2">
              <Label>Firmierung (rechtlicher Name)</Label>
              <Input
                value={company.legalName}
                onChange={(e) => update({ legalName: e.target.value })}
                className="h-11 rounded-xl"
                disabled={!canEdit}
              />
            </div>
            <div className="space-y-2">
              <Label>Ansprechpartner</Label>
              <Input
                value={company.contactName}
                onChange={(e) => update({ contactName: e.target.value })}
                className="h-11 rounded-xl"
                disabled={!canEdit}
              />
            </div>
            <div className="space-y-2">
              <Label>E-Mail</Label>
              <Input
                type="email"
                value={company.contactEmail}
                onChange={(e) => update({ contactEmail: e.target.value })}
                className="h-11 rounded-xl"
                disabled={!canEdit}
              />
            </div>
            <div className="space-y-2">
              <Label>Telefon</Label>
              <Input
                value={company.contactPhone}
                onChange={(e) => update({ contactPhone: e.target.value })}
                className="h-11 rounded-xl"
                disabled={!canEdit}
              />
            </div>
          </CardContent>
        </Card>

        {/* Rechnungsanschrift */}
        <Card className="border-0 shadow-lg bg-white dark:bg-slate-800 rounded-2xl">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Receipt className="h-5 w-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Rechnungsanschrift & Steuer</h3>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2 sm:col-span-2">
              <Label>Straße und Hausnummer</Label>
              <Input
                value={company.billingAddress.street}
                onChange={(e) => updateAddress({ street: e.target.value })}
                className="h-11 rounded-xl"
                disabled={!canEdit}
              />
            </div>
            <div className="space-y-2">
              <Label>PLZ</Label>
              <Input
                value={company.billingAddress.postalCode}
                onChange={(e) => updateAddress({ postalCode: e.target.value })}
                className="h-11 rounded-xl"
                disabled={!canEdit}
              />
            </div>
            <div className="space-y-2">
              <Label>Ort</Label>
              <Input
                value={company.billingAddress.city}
                onChange={(e) => updateAddress({ city: e.target.value })}
                className="h-11 rounded-xl"
                disabled={!canEdit}
              />
            </div>
            <div className="space-y-2">
              <Label>Land</Label>
              <Input
                value={company.billingAddress.country}
                onChange={(e) => updateAddress({ country: e.target.value })}
                placeholder="Deutschland"
                className="h-11 rounded-xl"
                disabled={!canEdit}
              />
            </div>
            <div className="space-y-2">
              <Label>Steuernummer</Label>
              <Input
                value={company.taxNumber}
                onChange={(e) => update({ taxNumber: e.target.value })}
                className="h-11 rounded-xl"
                disabled={!canEdit}
              />
            </div>
            <div className="space-y-2">
              <Label>Umsatzsteuer-ID</Label>
              <Input
                value={company.vatId}
                onChange={(e) => update({ vatId: e.target.value })}
                placeholder="DE…"
                className="h-11 rounded-xl"
                disabled={!canEdit}
              />
            </div>
            <div className="space-y-2">
              <Label>Standard-Umsatzsteuersatz (%)</Label>
              {numberInput(company.defaultVatRate, (v) => update({ defaultVatRate: v }))}
            </div>
          </CardContent>
        </Card>

        {/* Bank & Zahlungsziel */}
        <Card className="border-0 shadow-lg bg-white dark:bg-slate-800 rounded-2xl">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Landmark className="h-5 w-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Bankverbindung & Konditionen</h3>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>IBAN</Label>
              <Input
                value={company.iban}
                onChange={(e) => update({ iban: e.target.value })}
                placeholder="DE…"
                className="h-11 rounded-xl font-mono"
                disabled={!canEdit}
              />
            </div>
            <div className="space-y-2">
              <Label>BIC</Label>
              <Input
                value={company.bic}
                onChange={(e) => update({ bic: e.target.value })}
                className="h-11 rounded-xl font-mono"
                disabled={!canEdit}
              />
            </div>
            <div className="space-y-2">
              <Label>Bankname</Label>
              <Input
                value={company.bankName}
                onChange={(e) => update({ bankName: e.target.value })}
                className="h-11 rounded-xl"
                disabled={!canEdit}
              />
            </div>
            <div className="space-y-2">
              <Label>Zahlungsziel (Tage)</Label>
              {numberInput(company.defaultPaymentTermDays, (v) => update({ defaultPaymentTermDays: v }))}
            </div>
            <div className="space-y-2">
              <Label>Rechnungsnummern-Präfix</Label>
              <Input
                value={company.invoiceNumberPrefix}
                onChange={(e) => update({ invoiceNumberPrefix: e.target.value })}
                placeholder="z. B. RE"
                maxLength={12}
                className="h-11 rounded-xl"
                disabled={!canEdit}
              />
            </div>
          </CardContent>
        </Card>

        {error && (
          <Alert variant="destructive" className="rounded-xl">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {success && (
          <Alert className="rounded-xl bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800">
            <AlertDescription className="text-green-800 dark:text-green-300">{success}</AlertDescription>
          </Alert>
        )}

        {canEdit && (
          <Button
            type="submit"
            disabled={isSaving}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-12 px-8 shadow-lg hover:shadow-xl"
          >
            {isSaving ? 'Wird gespeichert…' : 'Änderungen speichern'}
          </Button>
        )}
      </form>
    </div>
  )
}
