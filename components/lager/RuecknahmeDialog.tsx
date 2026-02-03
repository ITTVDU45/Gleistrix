'use client'

import React, { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { LagerApi } from '@/lib/api/lager'

interface AssignmentRow {
  _id: string
  artikelId: { bezeichnung?: string; artikelnummer?: string } | string
  personId: { name?: string } | string
  menge: number
  ausgabedatum: string
  status: string
}

interface RuecknahmeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  assignments: AssignmentRow[]
  onSuccess: () => void
}

function getLabel(a: AssignmentRow) {
  const art = typeof a.artikelId === 'object' && a.artikelId ? (a.artikelId as { bezeichnung?: string; artikelnummer?: string }).bezeichnung ?? (a.artikelId as { artikelnummer?: string }).artikelnummer : '–'
  const person = typeof a.personId === 'object' && a.personId ? (a.personId as { name?: string }).name : '–'
  return `${art} → ${person} (${a.menge})`
}

export default function RuecknahmeDialog({
  open,
  onOpenChange,
  assignments,
  onSuccess
}: RuecknahmeDialogProps) {
  const [assignmentId, setAssignmentId] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!assignmentId) {
      setError('Bitte eine Ausgabe zur Rücknahme wählen.')
      return
    }
    setIsSubmitting(true)
    setError('')
    try {
      const res = await LagerApi.assignments.return(assignmentId)
      if ((res as any)?.success !== false) {
        setAssignmentId('')
        onOpenChange(false)
        onSuccess()
      } else {
        setError((res as any)?.message ?? 'Fehler bei der Rücknahme')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Fehler bei der Rücknahme')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>Rücknahme erfassen</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {error && (
            <div className="rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm p-3">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label>Offene Ausgabe *</Label>
            <Select value={assignmentId} onValueChange={setAssignmentId} required>
              <SelectTrigger className="rounded-xl h-10">
                <SelectValue placeholder="Ausgabe wählen" />
              </SelectTrigger>
              <SelectContent>
                {assignments.map((a) => (
                  <SelectItem key={a._id} value={a._id}>
                    {getLabel(a)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={isSubmitting || assignments.length === 0}>
              {isSubmitting ? 'Wird gespeichert…' : 'Rücknahme bestätigen'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
