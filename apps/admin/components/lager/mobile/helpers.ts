/**
 * Reine Hilfsfunktionen für die mobile Lager-App.
 * Aus LagerMobileApp.tsx extrahiert (keine Komponenten-State-Abhängigkeit).
 */
import type { Article, Category, Project } from '@/types/main'
import type { IncomingItem, ProjectOption } from './types'

export function getArticleId(article: Article): string {
  const raw = (article as { _id?: unknown })._id ?? article.id
  return raw != null ? String(raw) : ''
}

export function getCategoryId(category: Category): string {
  const raw = (category as { _id?: unknown })._id ?? category.id
  return raw != null ? String(raw) : ''
}

export function normalizeProjectStatus(status?: string): string {
  return String(status ?? '').trim().toLocaleLowerCase('de-DE')
}

export function buildProjectOptions(projects: Project[]): ProjectOption[] {
  const byId = new Map<string, ProjectOption>()

  projects.forEach((project) => {
    const id = String((project as { _id?: unknown })._id ?? project.id ?? '').trim()
    if (!id) return
    if (normalizeProjectStatus(project.status) !== 'aktiv') return

    const name = String(project.name ?? '').trim()
    if (!name) return

    const auftragsnummer = String(project.auftragsnummer ?? '').trim()
    byId.set(id, {
      value: id,
      label: auftragsnummer ? `${name} (${auftragsnummer})` : name
    })
  })

  return Array.from(byId.values()).sort((a, b) => a.label.localeCompare(b.label, 'de', { sensitivity: 'base' }))
}

export function createIncomingItem(): IncomingItem {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    artikelId: '',
    menge: 1
  }
}
