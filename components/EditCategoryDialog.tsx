'use client'

import React, { useState, useEffect } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { Pencil } from 'lucide-react'
import { LagerApi } from '@/lib/api/lager'
import type { Category } from '@/types/main'

interface EditCategoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  category: Category | null
  onSuccess?: () => void
}

function getCategoryId(cat: Category | null): string | undefined {
  if (!cat) return undefined
  return (cat as { _id?: string })._id?.toString?.() ?? cat.id
}

export default function EditCategoryDialog({
  open,
  onOpenChange,
  category,
  onSuccess
}: EditCategoryDialogProps) {
  const [name, setName] = useState('')
  const [beschreibung, setBeschreibung] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open && category) {
      setName(category.name ?? '')
      setBeschreibung(category.beschreibung ?? '')
      setError('')
    }
  }, [open, category])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const id = getCategoryId(category)
    if (!id) return
    if (!name.trim()) {
      setError('Name ist Pflicht.')
      return
    }
    setIsSubmitting(true)
    setError('')
    try {
      const res = await LagerApi.categories.update(id, {
        name: name.trim(),
        beschreibung: beschreibung.trim() || undefined
      })
      if ((res as { success?: boolean }).success) {
        onOpenChange(false)
        onSuccess?.()
      } else {
        setError((res as { message?: string }).message ?? 'Fehler beim Speichern')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Fehler beim Speichern')
    } finally {
      setIsSubmitting(false)
    }
  }

  const id = getCategoryId(category)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5" />
            Kategorie bearbeiten
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {error && (
            <div className="rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm p-3">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="edit-cat-name">Name *</Label>
            <Input
              id="edit-cat-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z.B. Akkus"
              className="rounded-xl h-10"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-cat-desc">Beschreibung</Label>
            <Input
              id="edit-cat-desc"
              value={beschreibung}
              onChange={(e) => setBeschreibung(e.target.value)}
              placeholder="optional"
              className="rounded-xl h-10"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={isSubmitting || !id}>
              {isSubmitting ? 'Wird gespeichert…' : 'Speichern'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
