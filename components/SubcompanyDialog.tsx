'use client'
import React from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'

interface SubcompanyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  submitLabel: string
  initial?: {
    name?: string
    employeeCount?: number
    address?: string
    phone?: string
    email?: string
    bankAccount?: string
  }
  onSubmit: (payload: {
    name: string
    employeeCount: number
    address?: string
    phone?: string
    email?: string
    bankAccount?: string
  }) => Promise<void> | void
}

export default function SubcompanyDialog({
  open,
  onOpenChange,
  title,
  submitLabel,
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
      setError('')
    }
  }, [open, initial?.name, initial?.employeeCount, initial?.address, initial?.phone, initial?.email, initial?.bankAccount])

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
      })
      onOpenChange(false)
    } catch (err: any) {
      setError(err?.message || 'Fehler beim Speichern')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl border-0 shadow-2xl bg-white dark:bg-slate-800">
        <DialogHeader className="pb-4 border-b border-slate-100 dark:border-slate-700">
          <DialogTitle className="text-xl font-semibold text-slate-900 dark:text-white">
            {title}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="subcompany-name" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Name *
            </Label>
            <Input
              id="subcompany-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Subunternehmen"
              className="rounded-xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/70 ring-1 ring-white dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:shadow-none dark:ring-0 h-12"
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
              className="rounded-xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/70 ring-1 ring-white dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:shadow-none dark:ring-0 h-12"
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
              className="rounded-xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/70 ring-1 ring-white dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:shadow-none dark:ring-0 h-12"
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
              className="rounded-xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/70 ring-1 ring-white dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:shadow-none dark:ring-0 h-12"
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
              className="rounded-xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/70 ring-1 ring-white dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:shadow-none dark:ring-0 h-12"
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
              className="rounded-xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/70 ring-1 ring-white dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:shadow-none dark:ring-0 h-12"
            />
          </div>
          {error && <div className="text-sm text-red-600">{error}</div>}
          <div className="flex justify-end gap-3 pt-2">
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
      </DialogContent>
    </Dialog>
  )
}
