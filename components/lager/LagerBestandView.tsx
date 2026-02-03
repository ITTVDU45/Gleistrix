'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Package, ArrowDownCircle, ArrowUpCircle, AlertTriangle } from 'lucide-react'
import type { Article, Category } from '@/types/main'
import WareneingangDialog from './WareneingangDialog'
import WarenausgangDialog from './WarenausgangDialog'

interface LagerBestandViewProps {
  articles: Article[]
  categories: Category[]
  onRefresh: () => void
}

export default function LagerBestandView({ articles, categories, onRefresh }: LagerBestandViewProps) {
  const [wareneingangOpen, setWareneingangOpen] = useState(false)
  const [warenausgangOpen, setWarenausgangOpen] = useState(false)

  const activeArticles = articles.filter((a) => (a.status ?? 'aktiv') === 'aktiv')
  const isUnterMindestbestand = (a: Article) =>
    (a.mindestbestand ?? 0) > 0 && (a.bestand ?? 0) < (a.mindestbestand ?? 0)
  const unterMindestbestandCount = activeArticles.filter(isUnterMindestbestand).length

  return (
    <>
      <Card className="border-0 shadow-lg bg-white dark:bg-slate-800 rounded-xl">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Bestandsübersicht</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                Aktueller Bestand pro Artikel und Lagerort
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="default"
                className="gap-2 bg-green-600 hover:bg-green-700"
                onClick={() => setWareneingangOpen(true)}
              >
                <ArrowDownCircle className="h-4 w-4" />
                Wareneingang
              </Button>
              <Button
                variant="default"
                className="gap-2 bg-amber-600 hover:bg-amber-700"
                onClick={() => setWarenausgangOpen(true)}
              >
                <ArrowUpCircle className="h-4 w-4" />
                Warenausgang
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {unterMindestbestandCount > 0 && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <span>
                {unterMindestbestandCount} {unterMindestbestandCount === 1 ? 'Artikel' : 'Artikel'} unter Mindestbestand
              </span>
            </div>
          )}
          {activeArticles.length > 0 ? (
            <div className="rounded-xl border border-slate-200 dark:border-slate-600 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 dark:bg-slate-700">
                    <TableHead className="font-medium text-slate-700 dark:text-slate-300">Artikelnummer</TableHead>
                    <TableHead className="font-medium text-slate-700 dark:text-slate-300">Bezeichnung</TableHead>
                    <TableHead className="font-medium text-slate-700 dark:text-slate-300">Kategorie</TableHead>
                    <TableHead className="font-medium text-slate-700 dark:text-slate-300">Lagerort</TableHead>
                    <TableHead className="font-medium text-slate-700 dark:text-slate-300 text-right">Bestand</TableHead>
                    <TableHead className="font-medium text-slate-700 dark:text-slate-300 text-right">Mindestbestand</TableHead>
                    <TableHead className="font-medium text-slate-700 dark:text-slate-300 w-[140px]">Warnung</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeArticles.map((a, idx) => (
                    <TableRow
                      key={a.id ?? (a as any)._id ?? idx}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-700 ${isUnterMindestbestand(a) ? 'bg-amber-50/50 dark:bg-amber-900/10 border-l-4 border-l-amber-500' : ''}`}
                    >
                      <TableCell className="font-medium dark:text-white">{a.artikelnummer}</TableCell>
                      <TableCell className="dark:text-slate-300">{a.bezeichnung}</TableCell>
                      <TableCell className="dark:text-slate-300">{a.kategorie}</TableCell>
                      <TableCell className="dark:text-slate-300">{a.lagerort || '–'}</TableCell>
                      <TableCell className="text-right font-medium dark:text-white">{a.bestand ?? 0}</TableCell>
                      <TableCell className="text-right dark:text-slate-300">{a.mindestbestand ?? 0}</TableCell>
                      <TableCell>
                        {isUnterMindestbestand(a) ? (
                          <Badge variant="destructive" className="whitespace-nowrap">Unter Mindestbestand</Badge>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500 text-sm">–</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12">
              <Package className="h-12 w-12 text-slate-400 dark:text-slate-500 mx-auto mb-4" />
              <p className="text-slate-600 dark:text-slate-400">Keine aktiven Artikel</p>
              <p className="text-sm text-slate-500 mt-1">Legen Sie zuerst Artikel im Tab „Artikel“ an.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <WareneingangDialog
        open={wareneingangOpen}
        onOpenChange={setWareneingangOpen}
        articles={activeArticles}
        onSuccess={onRefresh}
      />
      <WarenausgangDialog
        open={warenausgangOpen}
        onOpenChange={setWarenausgangOpen}
        articles={activeArticles}
        onSuccess={onRefresh}
      />
    </>
  )
}
