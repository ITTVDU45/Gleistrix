'use client'

import React, { useState, useEffect } from 'react'
import { LagerApi } from '@/lib/api/lager'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { Article, Category } from '@/types/main'
import AddArticleDialog from '@/components/AddArticleDialog'
import AddCategoryDialog from '@/components/AddCategoryDialog'
import ArticleListWithFilter from '@/components/ArticleListWithFilter'
import LagerBestandView from '@/components/lager/LagerBestandView'
import LagerBewegungenView from '@/components/lager/LagerBewegungenView'
import LagerAusgabeView from '@/components/lager/LagerAusgabeView'
import LagerInventurView from '@/components/lager/LagerInventurView'
import LagerWartungView from '@/components/lager/LagerWartungView'
import LagerLieferscheineView from '@/components/lager/LagerLieferscheineView'
import LagerKategorienView from '@/components/lager/LagerKategorienView'
import { Card, CardContent } from '@/components/ui/card'
import { Package, LayoutGrid, ArrowLeftRight, UserCheck, ClipboardCheck, Wrench, FileText, AlertTriangle, CalendarClock, ArrowLeft, FolderTree } from 'lucide-react'

interface LagerClientProps {
  initialArticles?: Article[]
  initialCategories?: Category[]
}

interface LagerStats {
  unterMindestbestand: number
  faelligeWartungen: number
  ueberfaelligeRueckgaben: number
}

export default function LagerClient({ initialArticles = [], initialCategories = [] }: LagerClientProps) {
  const [articles, setArticles] = useState<Article[]>(initialArticles)
  const [categories, setCategories] = useState<Category[]>(initialCategories)
  const [stats, setStats] = useState<LagerStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      const [articlesRes, categoriesRes, statsRes] = await Promise.all([
        LagerApi.articles.list(),
        LagerApi.categories.list(),
        LagerApi.stats().catch(() => ({ success: false, stats: null }))
      ])
      if (articlesRes?.success && articlesRes.articles) {
        setArticles(articlesRes.articles.map((a: Article) => ({
          ...a,
          id: (a as any)._id?.toString?.() ?? (a as any).id
        })))
      }
      if (categoriesRes?.success && categoriesRes.categories) {
        setCategories(categoriesRes.categories.map((c: Category) => ({
          ...c,
          id: (c as any)._id?.toString?.() ?? (c as any).id
        })))
      }
      if (statsRes?.success && (statsRes as { stats?: LagerStats }).stats) {
        setStats((statsRes as { stats: LagerStats }).stats)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden der Lagerdaten')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (initialArticles.length === 0 && initialCategories.length === 0) {
      loadData()
    } else {
      setArticles(initialArticles)
      setCategories(initialCategories)
      LagerApi.stats().then((res) => {
        if ((res as { success?: boolean; stats?: LagerStats }).success && (res as { stats?: LagerStats }).stats) {
          setStats((res as { stats: LagerStats }).stats)
        }
      }).catch(() => {})
    }
  }, [])

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Lager</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Artikel, Bestand, Bewegungen, Ausgabe und Inventur verwalten
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AddCategoryDialog onSuccess={loadData} />
          <AddArticleDialog categories={categories} onSuccess={loadData} />
        </div>
      </div>

      {stats && (stats.unterMindestbestand > 0 || stats.faelligeWartungen > 0 || stats.ueberfaelligeRueckgaben > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="rounded-xl border-amber-200 dark:border-amber-800">
            <CardContent className="pt-4 pb-4 flex items-center gap-3">
              <div className="rounded-lg bg-amber-100 dark:bg-amber-900/30 p-2">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Unter Mindestbestand</p>
                <p className="text-2xl font-semibold text-slate-900 dark:text-white">{stats.unterMindestbestand}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-xl border-blue-200 dark:border-blue-800">
            <CardContent className="pt-4 pb-4 flex items-center gap-3">
              <div className="rounded-lg bg-blue-100 dark:bg-blue-900/30 p-2">
                <CalendarClock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Fällige Wartungen</p>
                <p className="text-2xl font-semibold text-slate-900 dark:text-white">{stats.faelligeWartungen}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-xl border-red-200 dark:border-red-800">
            <CardContent className="pt-4 pb-4 flex items-center gap-3">
              <div className="rounded-lg bg-red-100 dark:bg-red-900/30 p-2">
                <ArrowLeft className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Überfällige Rückgaben</p>
                <p className="text-2xl font-semibold text-slate-900 dark:text-white">{stats.ueberfaelligeRueckgaben}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="artikel" className="w-full">
        <TabsList className="flex flex-wrap h-auto gap-1 p-1 bg-slate-100 dark:bg-slate-700 rounded-xl">
          <TabsTrigger value="artikel" className="gap-2 rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-600">
            <Package className="h-4 w-4" />
            Artikel
          </TabsTrigger>
          <TabsTrigger value="bestand" className="gap-2 rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-600">
            <LayoutGrid className="h-4 w-4" />
            Bestand
          </TabsTrigger>
          <TabsTrigger value="bewegungen" className="gap-2 rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-600">
            <ArrowLeftRight className="h-4 w-4" />
            Bewegungen
          </TabsTrigger>
          <TabsTrigger value="ausgabe" className="gap-2 rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-600">
            <UserCheck className="h-4 w-4" />
            Ausgabe / Rücknahme
          </TabsTrigger>
          <TabsTrigger value="wartung" className="gap-2 rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-600">
            <Wrench className="h-4 w-4" />
            Wartung
          </TabsTrigger>
          <TabsTrigger value="lieferscheine" className="gap-2 rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-600">
            <FileText className="h-4 w-4" />
            Lieferscheine
          </TabsTrigger>
          <TabsTrigger value="inventur" className="gap-2 rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-600">
            <ClipboardCheck className="h-4 w-4" />
            Inventur
          </TabsTrigger>
          <TabsTrigger value="kategorien" className="gap-2 rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-600">
            <FolderTree className="h-4 w-4" />
            Kategorien
          </TabsTrigger>
        </TabsList>

        <TabsContent value="artikel" className="mt-4">
          <ArticleListWithFilter articles={articles} categories={categories} onRefresh={loadData} />
        </TabsContent>
        <TabsContent value="bestand" className="mt-4">
          <LagerBestandView articles={articles} categories={categories} onRefresh={loadData} />
        </TabsContent>
        <TabsContent value="bewegungen" className="mt-4">
          <LagerBewegungenView articles={articles} onRefresh={loadData} />
        </TabsContent>
        <TabsContent value="ausgabe" className="mt-4">
          <LagerAusgabeView articles={articles} onRefresh={loadData} />
        </TabsContent>
        <TabsContent value="wartung" className="mt-4">
          <LagerWartungView articles={articles} onRefresh={loadData} />
        </TabsContent>
        <TabsContent value="lieferscheine" className="mt-4">
          <LagerLieferscheineView onRefresh={loadData} />
        </TabsContent>
        <TabsContent value="inventur" className="mt-4">
          <LagerInventurView articles={articles} onRefresh={loadData} />
        </TabsContent>
        <TabsContent value="kategorien" className="mt-4">
          <LagerKategorienView categories={categories} onRefresh={loadData} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
