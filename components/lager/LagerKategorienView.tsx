'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Pencil, Trash2 } from 'lucide-react'
import { LagerApi } from '@/lib/api/lager'
import AddCategoryDialog from '@/components/AddCategoryDialog'
import EditCategoryDialog from '@/components/EditCategoryDialog'
import type { Category } from '@/types/main'

interface LagerKategorienViewProps {
  categories: Category[]
  onRefresh: () => void
}

export default function LagerKategorienView({ categories, onRefresh }: LagerKategorienViewProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [editCategory, setEditCategory] = useState<Category | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleDelete = async (cat: Category) => {
    const id = (cat as { _id?: string })._id?.toString?.() ?? cat.id
    if (!id) return
    if (!confirm(`Kategorie „${cat.name}“ wirklich löschen?`)) return
    setError(null)
    setDeletingId(id)
    try {
      const res = await LagerApi.categories.delete(id)
      if ((res as { success?: boolean }).success) {
        onRefresh()
      } else {
        setError((res as { message?: string }).message ?? 'Löschen fehlgeschlagen')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Fehler beim Löschen')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <Card className="border-0 shadow-lg bg-white dark:bg-slate-800 rounded-xl">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Kategorien</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Kategorien anlegen und verwalten
            </p>
          </div>
          <AddCategoryDialog onSuccess={onRefresh} />
        </div>
      </CardHeader>
      <EditCategoryDialog
        open={editCategory !== null}
        onOpenChange={(open) => !open && setEditCategory(null)}
        category={editCategory}
        onSuccess={() => {
          setEditCategory(null)
          onRefresh()
        }}
      />
      <CardContent>
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm p-3">
            {error}
          </div>
        )}
        {categories.length === 0 ? (
          <p className="text-sm text-slate-500 py-6">Keine Kategorien vorhanden. Legen Sie eine neue Kategorie an.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Beschreibung</TableHead>
                <TableHead className="w-[120px]">Aktion</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((cat) => {
                const id = (cat as { _id?: string })._id?.toString?.() ?? cat.id
                return (
                  <TableRow key={id ?? cat.name}>
                    <TableCell className="font-medium">{cat.name}</TableCell>
                    <TableCell className="text-slate-600 dark:text-slate-400">
                      {cat.beschreibung ?? '–'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-slate-600 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
                          onClick={() => setEditCategory(cat)}
                          aria-label={`Kategorie ${cat.name} bearbeiten`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                          onClick={() => handleDelete(cat)}
                          disabled={deletingId === id}
                          aria-label={`Kategorie ${cat.name} löschen`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
