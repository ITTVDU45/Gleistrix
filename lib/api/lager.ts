import { getJSON, postJSON, putJSON, delJSON } from '@/lib/http/apiClient'
import type { Article, Category, StockMovement } from '@/types/main'

export const LagerApi = {
  stats: () =>
    getJSON<{ success: boolean; stats: { unterMindestbestand: number; faelligeWartungen: number; ueberfaelligeRueckgaben: number } }>('/api/lager/stats'),
  articles: {
    list: (params?: { kategorie?: string; typ?: string; lagerort?: string; status?: string }) => {
      const search = new URLSearchParams()
      if (params?.kategorie) search.set('kategorie', params.kategorie)
      if (params?.typ) search.set('typ', params.typ)
      if (params?.lagerort) search.set('lagerort', params.lagerort)
      if (params?.status) search.set('status', params.status)
      const q = search.toString()
      return getJSON<{ success: boolean; articles: Article[] }>(`/api/lager/articles${q ? `?${q}` : ''}`)
    },
    get: (id: string) =>
      getJSON<{ success: boolean; data: Article }>(`/api/lager/articles/${id}`),
    create: (data: Partial<Article>) =>
      postJSON(`/api/lager/articles`, data as Record<string, unknown>, 'lager:article:create'),
    update: (id: string, data: Partial<Article>) =>
      putJSON(`/api/lager/articles/${id}`, data as Record<string, unknown>, 'lager:article:update'),
    archive: (id: string) =>
      delJSON(`/api/lager/articles/${id}`, 'lager:article:delete')
  },
  categories: {
    list: () =>
      getJSON<{ success: boolean; categories: Category[] }>('/api/lager/categories'),
    get: (id: string) =>
      getJSON<{ success: boolean; data: Category }>(`/api/lager/categories/${id}`),
    create: (data: { name: string; parentId?: string | null; beschreibung?: string }) =>
      postJSON('/api/lager/categories', data, 'lager:category:create'),
    update: (id: string, data: Partial<Category>) =>
      putJSON(`/api/lager/categories/${id}`, data as Record<string, unknown>, 'lager:category:update'),
    delete: (id: string) =>
      delJSON(`/api/lager/categories/${id}`, 'lager:category:delete')
  },
  movements: {
    list: (params?: { artikelId?: string; bewegungstyp?: string; datumVon?: string; datumBis?: string }) => {
      const search = new URLSearchParams()
      if (params?.artikelId) search.set('artikelId', params.artikelId)
      if (params?.bewegungstyp) search.set('bewegungstyp', params.bewegungstyp)
      if (params?.datumVon) search.set('datumVon', params.datumVon)
      if (params?.datumBis) search.set('datumBis', params.datumBis)
      const q = search.toString()
      return getJSON<{ success: boolean; movements: StockMovement[] }>(`/api/lager/movements${q ? `?${q}` : ''}`)
    },
    create: (data: {
      artikelId: string
      bewegungstyp: 'eingang' | 'ausgang' | 'korrektur' | 'inventur'
      menge: number
      datum: string | Date
      empfaenger?: string | null
      lieferscheinId?: string | null
      bemerkung?: string
    }) =>
      postJSON('/api/lager/movements', data as Record<string, unknown>, 'lager:movement:create')
  },
  assignments: {
    list: (params?: { personId?: string; artikelId?: string; status?: string }) => {
      const search = new URLSearchParams()
      if (params?.personId) search.set('personId', params.personId)
      if (params?.artikelId) search.set('artikelId', params.artikelId)
      if (params?.status) search.set('status', params.status)
      const q = search.toString()
      return getJSON<{ success: boolean; assignments: unknown[] }>(`/api/lager/assignments${q ? `?${q}` : ''}`)
    },
    create: (data: {
      artikelId: string
      personId: string
      menge?: number
      ausgabedatum: string | Date
      geplanteRueckgabe?: string | Date | null
      bemerkung?: string
      createDeliveryNote?: boolean
    }) =>
      postJSON('/api/lager/assignments', data as Record<string, unknown>, 'lager:assignments:create'),
    bulk: (data: {
      personId: string
      ausgabedatum: string | Date
      geplanteRueckgabe?: string | Date | null
      bemerkung?: string
      createDeliveryNote?: boolean
      positionen: { artikelId: string; menge: number }[]
    }) =>
      postJSON('/api/lager/assignments/bulk', data as Record<string, unknown>, 'lager:assignments:bulk'),
    return: (id: string) =>
      putJSON(`/api/lager/assignments/${id}/return`, {}, 'lager:assignments:return')
  },
  maintenance: {
    list: (params?: { artikelId?: string; status?: string }) => {
      const search = new URLSearchParams()
      if (params?.artikelId) search.set('artikelId', params.artikelId)
      if (params?.status) search.set('status', params.status)
      const q = search.toString()
      return getJSON<{ success: boolean; maintenance: unknown[] }>(`/api/lager/maintenance${q ? `?${q}` : ''}`)
    },
    get: (id: string) =>
      getJSON<{ success: boolean; data: unknown }>(`/api/lager/maintenance/${id}`),
    create: (data: { artikelId: string; wartungsart: string; faelligkeitsdatum: string | Date; status?: string }) =>
      postJSON('/api/lager/maintenance', data as Record<string, unknown>, 'lager:maintenance:create'),
    update: (id: string, data: { durchfuehrungsdatum?: string | Date | null; status?: string; ergebnis?: string; naechsterTermin?: string | Date | null }) =>
      putJSON(`/api/lager/maintenance/${id}`, data as Record<string, unknown>, 'lager:maintenance:update')
  },
  deliveryNotes: {
    list: () =>
      getJSON<{ success: boolean; deliveryNotes: unknown[] }>('/api/lager/delivery-notes'),
    get: (id: string) =>
      getJSON<{ success: boolean; data: unknown }>(`/api/lager/delivery-notes/${id}`),
    create: (data: {
      typ: 'eingang' | 'ausgang'
      datum: string | Date
      empfaenger: { name: string; adresse?: string }
      positionen: { artikelId: string; bezeichnung: string; menge: number; seriennummer?: string }[]
    }) =>
      postJSON('/api/lager/delivery-notes', data as Record<string, unknown>, 'lager:delivery-note:create')
  },
  inventory: {
    list: () =>
      getJSON<{ success: boolean; inventory: unknown[] }>('/api/lager/inventory'),
    get: (id: string) =>
      getJSON<{ success: boolean; data: unknown }>(`/api/lager/inventory/${id}`),
    create: (data: { typ: 'voll' | 'teil'; stichtag: string | Date; kategorien?: string[]; lagerorte?: string[] }) =>
      postJSON('/api/lager/inventory', data as Record<string, unknown>, 'lager:inventory:create'),
    update: (id: string, data: { positionen: { artikelId: string; istMenge: number }[] }) =>
      putJSON(`/api/lager/inventory/${id}`, data as Record<string, unknown>, 'lager:inventory:update'),
    complete: (id: string) =>
      postJSON(`/api/lager/inventory/${id}/complete`, {}, 'lager:inventory:complete')
  }
}
