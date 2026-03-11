'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog'
import { FolderPlus } from 'lucide-react'
import { LagerApi } from '@/lib/api/lager'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from './ui/select'
import type { Category } from '@/types/main'

interface AddCategoryDialogProps {
  onSuccess?: (createdCategory?: Category) => void
  categories?: Category[]
  trigger?: React.ReactNode
  defaultParentId?: string | null
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

function getCategoryId(category: Category): string {
  return toId((category as { _id?: unknown })._id) || toId(category.id)
}

function getParentId(category: Category): string {
  const parentId = toId(category.parentId)
  if (!parentId || parentId === 'none' || parentId === 'null') return ''
  return parentId
}

export default function AddCategoryDialog({
  onSuccess,
  categories,
  trigger,
  defaultParentId = null
}: AddCategoryDialogProps) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [beschreibung, setBeschreibung] = useState('')
  const [parentId, setParentId] = useState<string>(defaultParentId ?? 'none')
  const [availableCategories, setAvailableCategories] = useState<Category[]>(categories ?? [])
  const [isLoadingCategories, setIsLoadingCategories] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    if (categories) {
      setAvailableCategories(categories)
      return
    }

    let cancelled = false
    setIsLoadingCategories(true)

    LagerApi.categories
      .list()
      .then((res) => {
        if (!cancelled && res?.success && Array.isArray(res.categories)) {
          const normalized = res.categories.map((c) => ({
            ...c,
            id: getCategoryId(c)
          }))
          setAvailableCategories(normalized)
        }
      })
      .catch(() => {
        if (!cancelled) setAvailableCategories([])
      })
      .finally(() => {
        if (!cancelled) setIsLoadingCategories(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, categories])

  useEffect(() => {
    if (!open) {
      setParentId(defaultParentId ?? 'none')
    }
  }, [defaultParentId, open])

  const topLevelCategories = useMemo(() => {
    const allCategoryIds = new Set(
      availableCategories
        .map((category) => getCategoryId(category))
        .filter((id) => !!id)
    )

    return availableCategories
      .filter((category) => {
        const pid = getParentId(category)
        return !pid || !allCategoryIds.has(pid)
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'de'))
  }, [availableCategories])

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
        parentId: parentId === 'none' ? null : parentId,
        beschreibung: beschreibung.trim() || undefined
      })

      if ((res as { success?: boolean }).success !== false) {
        const createdCategory = (res as { data?: Category }).data
        setName('')
        setBeschreibung('')
        setParentId(defaultParentId ?? 'none')
        setOpen(false)
        onSuccess?.(createdCategory)
      } else {
        setError((res as { message?: string }).message ?? 'Fehler beim Anlegen der Kategorie')
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
        {trigger ?? (
          <Button variant="outline" size="sm" className="gap-2 rounded-xl">
            <FolderPlus className="h-4 w-4" />
            Kategorie anlegen
          </Button>
        )}
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
            <Label>Oberkategorie</Label>
            <Select value={parentId} onValueChange={setParentId} disabled={isLoadingCategories}>
              <SelectTrigger className="rounded-xl h-10">
                <SelectValue placeholder="Keine Oberkategorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Keine Oberkategorie</SelectItem>
                {topLevelCategories.map((category) => {
                  const categoryId = getCategoryId(category)
                  if (!categoryId) return null
                  return (
                    <SelectItem key={categoryId} value={categoryId}>
                      {category.name}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
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
              {isSubmitting ? 'Wird gespeichert...' : 'Speichern'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
