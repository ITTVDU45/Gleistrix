'use client'

import React, { useMemo, useState, useEffect } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { Pencil } from 'lucide-react'
import { LagerApi } from '@/lib/api/lager'
import type { Category } from '@/types/main'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from './ui/select'

interface EditCategoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  category: Category | null
  categories?: Category[]
  onSuccess?: () => void
}

function toId(value: unknown): string {
  if (!value) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'object') {
    const record = value as { $oid?: unknown; _id?: unknown; toString?: () => string }
    if (typeof record.$oid === 'string') return record.$oid
    if (typeof record._id === 'string') return record._id
    if (typeof record.toString === 'function') {
      const str = record.toString()
      if (str && str !== '[object Object]') return str
    }
  }
  return ''
}

function getCategoryId(cat: Category | null): string | undefined {
  if (!cat) return undefined
  return toId((cat as { _id?: unknown })._id) || toId(cat.id)
}

function getParentId(cat: Category | null): string {
  const parentId = toId(cat?.parentId)
  if (!parentId || parentId === 'none' || parentId === 'null') return 'none'
  return parentId
}

export default function EditCategoryDialog({
  open,
  onOpenChange,
  category,
  categories = [],
  onSuccess
}: EditCategoryDialogProps) {
  const [name, setName] = useState('')
  const [beschreibung, setBeschreibung] = useState('')
  const [parentId, setParentId] = useState('none')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open && category) {
      setName(category.name ?? '')
      setBeschreibung(category.beschreibung ?? '')
      setParentId(getParentId(category))
      setError('')
    }
  }, [open, category])

  const selectableParents = useMemo(() => {
    const currentId = getCategoryId(category)
    const allCategoryIds = new Set(
      categories
        .map((cat) => getCategoryId(cat) ?? '')
        .filter((id) => !!id)
    )

    return categories
      .filter((cat) => {
        const pid = getParentId(cat)
        return pid === 'none' || !allCategoryIds.has(pid)
      })
      .filter((cat) => getCategoryId(cat) !== currentId)
      .sort((a, b) => a.name.localeCompare(b.name, 'de'))
  }, [categories, category])

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
        parentId: parentId === 'none' ? null : parentId,
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
            <Label>Oberkategorie</Label>
            <Select value={parentId} onValueChange={setParentId}>
              <SelectTrigger className="rounded-xl h-10">
                <SelectValue placeholder="Keine Oberkategorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Keine Oberkategorie</SelectItem>
                {selectableParents.map((cat) => {
                  const catId = getCategoryId(cat)
                  if (!catId) return null
                  return (
                    <SelectItem key={catId} value={catId}>
                      {cat.name}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
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
              {isSubmitting ? 'Wird gespeichert...' : 'Speichern'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
