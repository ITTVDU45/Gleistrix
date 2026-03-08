'use client'

import React, { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { UserPlus } from 'lucide-react'
import { LagerApi } from '@/lib/api/lager'

interface AddRecipientDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: (recipients: string[], createdName: string) => void
}

function normalizeRecipientName(name: string): string {
  return name.trim().replace(/\s+/g, ' ')
}

export default function AddRecipientDialog({ open, onOpenChange, onCreated }: AddRecipientDialogProps) {
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!open) {
      setName('')
      setError('')
      setIsSubmitting(false)
    }
  }, [open])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const normalizedName = normalizeRecipientName(name)

    if (!normalizedName) {
      setError('Bitte einen gueltigen Empfaengernamen eingeben.')
      return
    }

    setIsSubmitting(true)
    setError('')

    try {
      const response = await LagerApi.recipients.create({ name: normalizedName })
      onCreated?.(response.recipients ?? [], normalizedName)
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Empfaenger konnte nicht gespeichert werden')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-blue-600" />
            Neuen Empfaenger anlegen
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-1">
          <div className="space-y-2">
            <Label htmlFor="recipient-name">Name *</Label>
            <Input
              id="recipient-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="z. B. Max Mustermann / Firma XY"
              className="rounded-xl h-11"
              autoFocus
              required
            />
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
              {isSubmitting ? 'Speichere...' : 'Empfaenger speichern'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}