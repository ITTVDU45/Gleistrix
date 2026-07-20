'use client'

import React, { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Building2 } from 'lucide-react'
import { LagerApi } from '@/lib/api/lager'

type EditablePartner = {
  id: string
  type: 'employee' | 'external'
  companyName?: string
  contactName?: string
  phone?: string
  email?: string
  active: boolean
}

interface AddPartnerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  partner?: EditablePartner | null
  onSaved?: () => void
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

export default function AddPartnerDialog({ open, onOpenChange, partner, onSaved }: AddPartnerDialogProps) {
  const isEditMode = Boolean(partner)
  const [companyName, setCompanyName] = useState('')
  const [contactName, setContactName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!open) {
      setError('')
      setIsSubmitting(false)
      return
    }

    setCompanyName(partner?.companyName ?? '')
    setContactName(partner?.contactName ?? '')
    setPhone(partner?.phone ?? '')
    setEmail(partner?.email ?? '')
    setError('')
  }, [open, partner])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (partner?.type === 'employee') {
      setError('Mitarbeiter werden aus der Mitarbeiterliste verwaltet.')
      return
    }

    const normalizedCompany = normalizeText(companyName)
    const normalizedContact = normalizeText(contactName)
    const normalizedPhone = normalizeText(phone)
    const normalizedEmail = normalizeText(email)

    if (!normalizedCompany || !normalizedContact) {
      setError('Firma und Ansprechpartner sind erforderlich.')
      return
    }
    if (!normalizedPhone && !normalizedEmail) {
      setError('Bitte Telefon oder E-Mail eintragen.')
      return
    }

    setIsSubmitting(true)
    setError('')

    try {
      if (isEditMode && partner) {
        await LagerApi.partners.update(partner.id, {
          type: 'external',
          companyName: normalizedCompany,
          contactName: normalizedContact,
          phone: normalizedPhone,
          email: normalizedEmail,
          active: true
        })
      } else {
        await LagerApi.partners.create({
          type: 'external',
          companyName: normalizedCompany,
          contactName: normalizedContact,
          phone: normalizedPhone,
          email: normalizedEmail
        })
      }

      onSaved?.()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lieferant konnte nicht gespeichert werden')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-blue-600" />
            {isEditMode ? 'Firma bearbeiten' : 'Neue Firma anlegen'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-1">
          <div className="space-y-2">
            <Label htmlFor="partner-company">Firmenname *</Label>
            <Input
              id="partner-company"
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
              className="rounded-xl h-11"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="partner-contact">Ansprechpartner *</Label>
            <Input
              id="partner-contact"
              value={contactName}
              onChange={(event) => setContactName(event.target.value)}
              className="rounded-xl h-11"
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="partner-phone">Telefon</Label>
              <Input
                id="partner-phone"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                className="rounded-xl h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="partner-email">E-Mail</Label>
              <Input
                id="partner-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="rounded-xl h-11"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm p-3">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Speichere...' : isEditMode ? 'Speichern' : 'Firma speichern'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
