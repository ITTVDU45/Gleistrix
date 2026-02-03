'use client'

import React, { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader } from './ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table'
import { Badge } from './ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from './ui/select'
import { Input } from './ui/input'
import { Package } from 'lucide-react'
import type { Article, Category, ArticleStatus } from '@/types/main'
import ArticleActions from './ArticleActions'
import AddArticleDialog from './AddArticleDialog'

interface ArticleListWithFilterProps {
  articles: Article[]
  categories: Category[]
  onRefresh: () => void
}

const STATUS_OPTIONS: { value: ArticleStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Alle' },
  { value: 'aktiv', label: 'Aktiv' },
  { value: 'archiviert', label: 'Archiviert' },
  { value: 'gesperrt', label: 'Gesperrt' }
]

export default function ArticleListWithFilter({
  articles,
  categories,
  onRefresh
}: ArticleListWithFilterProps) {
  const [kategorieFilter, setKategorieFilter] = useState<string>('all')
  const [typFilter, setTypFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    let list = [...articles]
    if (kategorieFilter && kategorieFilter !== 'all') {
      list = list.filter((a) => a.kategorie === kategorieFilter)
    }
    if (typFilter && typFilter !== 'all') {
      list = list.filter((a) => a.typ === typFilter)
    }
    if (statusFilter && statusFilter !== 'all') {
      list = list.filter((a) => (a.status ?? 'aktiv') === statusFilter)
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(
        (a) =>
          a.bezeichnung?.toLowerCase().includes(q) ||
          a.artikelnummer?.toLowerCase().includes(q) ||
          (a as any).barcode?.toLowerCase().includes(q)
      )
    }
    return list
  }, [articles, kategorieFilter, typFilter, statusFilter, search])

  return (
    <Card className="border-0 shadow-lg bg-white dark:bg-slate-800 rounded-xl">
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Artikel</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              {filtered.length} von {articles.length} Artikeln
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <AddArticleDialog categories={categories} onSuccess={onRefresh} />
            <Input
              placeholder="Suchen (Bezeichnung, Nr., Barcode)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-[220px] rounded-xl h-9"
            />
            <Select value={kategorieFilter} onValueChange={setKategorieFilter}>
              <SelectTrigger className="w-[160px] rounded-xl h-9">
                <SelectValue placeholder="Kategorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Kategorien</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id ?? (c as any)._id ?? c.name} value={c.name}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={typFilter} onValueChange={setTypFilter}>
              <SelectTrigger className="w-[140px] rounded-xl h-9">
                <SelectValue placeholder="Typ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Typen</SelectItem>
                <SelectItem value="Werkzeug">Werkzeug</SelectItem>
                <SelectItem value="Maschine">Maschine</SelectItem>
                <SelectItem value="Akku">Akku</SelectItem>
                <SelectItem value="Komponente">Komponente</SelectItem>
                <SelectItem value="Verbrauch">Verbrauch</SelectItem>
                <SelectItem value="Sonstiges">Sonstiges</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[120px] rounded-xl h-9">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filtered.length > 0 ? (
          <div className="rounded-xl border border-slate-200 dark:border-slate-600 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 dark:bg-slate-700">
                  <TableHead className="font-medium text-slate-700 dark:text-slate-300">
                    Artikelnummer
                  </TableHead>
                  <TableHead className="font-medium text-slate-700 dark:text-slate-300">
                    Bezeichnung
                  </TableHead>
                  <TableHead className="font-medium text-slate-700 dark:text-slate-300">
                    Kategorie
                  </TableHead>
                  <TableHead className="font-medium text-slate-700 dark:text-slate-300">Typ</TableHead>
                  <TableHead className="font-medium text-slate-700 dark:text-slate-300">
                    Bestand
                  </TableHead>
                  <TableHead className="font-medium text-slate-700 dark:text-slate-300">
                    Lagerort
                  </TableHead>
                  <TableHead className="font-medium text-slate-700 dark:text-slate-300">
                    Status
                  </TableHead>
                  <TableHead className="font-medium text-slate-700 dark:text-slate-300 text-right">
                    Aktionen
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((article, idx) => {
                  const rowKey =
                    article.id ?? (article as any)._id?.toString?.() ?? `art-${idx}`
                  return (
                    <TableRow
                      key={rowKey}
                      className="hover:bg-slate-50 dark:hover:bg-slate-700"
                    >
                      <TableCell className="font-medium dark:text-white">
                        {article.artikelnummer}
                      </TableCell>
                      <TableCell className="dark:text-slate-300">
                        {article.bezeichnung}
                      </TableCell>
                      <TableCell className="dark:text-slate-300">
                        {article.kategorie}
                      </TableCell>
                      <TableCell className="dark:text-slate-300">{article.typ}</TableCell>
                      <TableCell className="dark:text-slate-300">{article.bestand ?? 0}</TableCell>
                      <TableCell className="dark:text-slate-300">
                        {article.lagerort || '–'}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            (article.status ?? 'aktiv') === 'archiviert' ? 'secondary' : 'default'
                          }
                        >
                          {article.status ?? 'aktiv'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <ArticleActions article={article} categories={categories} onRefresh={onRefresh} />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-12">
            <Package className="h-12 w-12 text-slate-400 dark:text-slate-500 mx-auto mb-4" />
            <p className="text-slate-600 dark:text-slate-400">Keine Artikel gefunden</p>
            <p className="text-sm text-slate-500 dark:text-slate-500 mt-1">
              Legen Sie einen Artikel an oder passen Sie die Filter an
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
