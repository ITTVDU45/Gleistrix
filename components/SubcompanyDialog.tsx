'use client'
import { getErrorMessage } from '@/lib/errors'
import React from 'react'
import type { SubcompanyFunctionRate, SubcompanySurchargeRates } from '@/types/main'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import SubcompanyRatesEditor, { type RatesValue } from './subunternehmen/SubcompanyRatesEditor'
import SubcompanyDocumentsManager from './subunternehmen/SubcompanyDocumentsManager'

export interface SubcompanyDialogPayload {
  name: string
  employeeCount: number
  address?: string
  phone?: string
  email?: string
  bankAccount?: string
  functionRates?: SubcompanyFunctionRate[]
  surchargeRates?: SubcompanySurchargeRates
}

interface SubcompanyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  submitLabel: string
  /** Nur im Bearbeiten-Modus vorhanden – schaltet den Dokumente-Tab frei */
  subcompanyId?: string
  initial?: {
    name?: string
    employeeCount?: number
    address?: string
    phone?: string
    email?: string
    bankAccount?: string
    functionRates?: SubcompanyFunctionRate[]
    surchargeRates?: SubcompanySurchargeRates
  }
  onSubmit: (payload: SubcompanyDialogPayload) => Promise<void> | void
}

const inputClass =
  'rounded-xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/70 ring-1 ring-white dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:shadow-none dark:ring-0 h-12'

export default function SubcompanyDialog({
  open,
  onOpenChange,
  title,
  submitLabel,
  subcompanyId,
  initial,
  onSubmit,
}: SubcompanyDialogProps) {
  const [name, setName] = React.useState(initial?.name || '')
  const [employeeCount, setEmployeeCount] = React.useState(
    initial?.employeeCount ? String(initial.employeeCount) : ''
  )
  const [address, setAddress] = React.useState(initial?.address || '')
  const [phone, setPhone] = React.useState(initial?.phone || '')
  const [email, setEmail] = React.useState(initial?.email || '')
  const [bankAccount, setBankAccount] = React.useState(initial?.bankAccount || '')
  const [rates, setRates] = React.useState<RatesValue>({
    functionRates: initial?.functionRates || [],
    surchargeRates: initial?.surchargeRates || {},
  })
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [error, setError] = React.useState('')

  React.useEffect(() => {
    if (open) {
      setName(initial?.name || '')
      setEmployeeCount(initial?.employeeCount ? String(initial.employeeCount) : '')
      setAddress(initial?.address || '')
      setPhone(initial?.phone || '')
      setEmail(initial?.email || '')
      setBankAccount(initial?.bankAccount || '')
      setRates({
        functionRates: initial?.functionRates || [],
        surchargeRates: initial?.surchargeRates || {},
      })
      setError('')
    }
    // Der Dialog wird beim Öffnen mit den aktuellen Stammdaten befüllt;
    // `initial` ist ein frisches Objekt pro Render, daher gezielte Deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const count = parseInt(employeeCount, 10)
    if (!name.trim()) {
      setError('Name ist erforderlich.')
      return
    }
    if (!Number.isFinite(count) || count < 1) {
      setError('Mitarbeiteranzahl muss mindestens 1 sein.')
      return
    }

    setIsSubmitting(true)
    try {
      await onSubmit({
        name: name.trim(),
        employeeCount: count,
        address: address.trim(),
        phone: phone.trim(),
        email: email.trim(),
        bankAccount: bankAccount.trim(),
        functionRates: rates.functionRates,
        surchargeRates: rates.surchargeRates,
      })
      onOpenChange(false)
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Fehler beim Speichern'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl rounded-2xl border-0 shadow-2xl bg-white dark:bg-slate-800 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-4 border-b border-slate-100 dark:border-slate-700">
          <DialogTitle className="text-xl font-semibold text-slate-900 dark:text-white">
            {title}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="stammdaten" className="pt-2">
          <TabsList className="rounded-xl">
            <TabsTrigger value="stammdaten" className="rounded-lg">Stammdaten</TabsTrigger>
            <TabsTrigger value="preise" className="rounded-lg">Preise</TabsTrigger>
            {subcompanyId && (
              <TabsTrigger value="dokumente" className="rounded-lg">Dokumente</TabsTrigger>
            )}
          </TabsList>

          <form onSubmit={handleSubmit}>
            <TabsContent value="stammdaten" className="space-y-4 pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="subcompany-name" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Name *
                  </Label>
                  <Input
                    id="subcompany-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Subunternehmen"
                    className={inputClass}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subcompany-count" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Mitarbeiteranzahl *
                  </Label>
                  <Input
                    id="subcompany-count"
                    type="number"
                    min={1}
                    value={employeeCount}
                    onChange={(e) => setEmployeeCount(e.target.value)}
                    placeholder="z.B. 5"
                    className={inputClass}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subcompany-email" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    E-Mail
                  </Label>
                  <Input
                    id="subcompany-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@beispiel.de"
                    className={inputClass}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subcompany-phone" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Telefon
                  </Label>
                  <Input
                    id="subcompany-phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+49 123 456789"
                    className={inputClass}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subcompany-address" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Adresse
                  </Label>
                  <Input
                    id="subcompany-address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Strasse, PLZ, Ort"
                    className={inputClass}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subcompany-bank" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Bankkonto
                  </Label>
                  <Input
                    id="subcompany-bank"
                    value={bankAccount}
                    onChange={(e) => setBankAccount(e.target.value)}
                    placeholder="IBAN / Bankverbindung"
                    className={inputClass}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="preise" className="pt-4">
              <SubcompanyRatesEditor value={rates} onChange={setRates} />
            </TabsContent>

            {error && <div className="text-sm text-red-600 pt-3">{error}</div>}
            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="rounded-xl"
                disabled={isSubmitting}
              >
                Abbrechen
              </Button>
              <Button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Speichern...' : submitLabel}
              </Button>
            </div>
          </form>

          {subcompanyId && (
            <TabsContent value="dokumente" className="pt-4">
              <SubcompanyDocumentsManager subcompanyId={subcompanyId} />
            </TabsContent>
          )}
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
