'use client'

import React, { useState } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog'
import { FolderPlus } from 'lucide-react'
import { LagerApi } from '@/lib/api/lager'

interface AddCategoryDialogProps {
  onSuccess?: () => void
}

export default function AddCategoryDialog({ onSuccess }: AddCategoryDialogProps) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [beschreibung, setBeschreibung] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Name ist Pflicht.')
      return
    }
    setIsSubmitting(true)
    setError('')
    try {
      const res = await LagerApi.categories.create({
        name: name.trim(),
        beschreibung: beschreibung.trim() || undefined
      })
      if ((res as any)?.success !== false) {
        setName('')
        setBeschreibung('')
        setOpen(false)
        onSuccess?.()
      } else {
        setError((res as any)?.message ?? 'Fehler beim Anlegen der Kategorie')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Fehler beim Anlegen der Kategorie')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 rounded-xl">
          <FolderPlus className="h-4 w-4" />
          Kategorie anlegen
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderPlus className="h-5 w-5" />
            Neue Kategorie
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {error && (
            <div className="rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm p-3">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="cat-name">Name *</Label>
            <Input
              id="cat-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z.B. Akkus"
              className="rounded-xl h-10"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cat-desc">Beschreibung</Label>
            <Input
              id="cat-desc"
              value={beschreibung}
              onChange={(e) => setBeschreibung(e.target.value)}
              placeholder="optional"
              className="rounded-xl h-10"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Wird gespeichert…' : 'Speichern'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
