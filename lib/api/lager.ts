import { getJSON, postJSON, putJSON, delJSON } from '@/lib/http/apiClient'
import type { Article, ArticleUnit, Category, StockMovement } from '@/types/main'

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
      delJSON(`/api/lager/articles/${id}`, 'lager:article:delete'),
    uploadImage: async (articleId: string, file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`/api/lager/articles/${articleId}/images/upload`, {
        method: 'POST',
        headers: { 'x-csrf-intent': 'lager:article:image:upload' },
        body: formData,
        credentials: 'include'
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error((body as { message?: string }).message || `Upload fehlgeschlagen (${res.status})`)
      }
      return res.json()
    },
    getImageUrl: async (articleId: string, attachmentId: string) => {
      return { success: true, url: `/api/lager/articles/${articleId}/images/${attachmentId}` }
    },
    deleteImage: (articleId: string, attachmentId: string) =>
      delJSON(
        `/api/lager/articles/${articleId}/images/${attachmentId}`,
        'lager:article:image:delete'
      )
  },
  units: {
    list: (articleId: string, params?: { status?: string }) => {
      const search = new URLSearchParams()
      if (params?.status) search.set('status', params.status)
      const q = search.toString()
      return getJSON<{ success: boolean; units: ArticleUnit[] }>(
        `/api/lager/articles/${articleId}/units${q ? `?${q}` : ''}`
      )
    },
    get: (articleId: string, unitId: string) =>
      getJSON<{ success: boolean; data: ArticleUnit }>(
        `/api/lager/articles/${articleId}/units/${unitId}`
      ),
    create: (articleId: string, data: { seriennummer: string; zustand?: string; lagerort?: string; notizen?: string }) =>
      postJSON<{ success: boolean; data: ArticleUnit }>(
        `/api/lager/articles/${articleId}/units`,
        data as Record<string, unknown>,
        'lager:unit:create'
      ),
    update: (articleId: string, unitId: string, data: { seriennummer?: string; zustand?: string; lagerort?: string; notizen?: string; status?: string }) =>
      putJSON<{ success: boolean; data: ArticleUnit }>(
        `/api/lager/articles/${articleId}/units/${unitId}`,
        data as Record<string, unknown>,
        'lager:unit:update'
      ),
    delete: (articleId: string, unitId: string) =>
      delJSON(
        `/api/lager/articles/${articleId}/units/${unitId}`,
        'lager:unit:delete'
      ),
    bulkCreate: (articleId: string, units: { seriennummer: string; zustand?: string; lagerort?: string }[]) =>
      postJSON<{ success: boolean; data: { created: number; bestand: number } }>(
        `/api/lager/articles/${articleId}/units/bulk`,
        { units } as Record<string, unknown>,
        'lager:unit:bulk'
      )
  },
  articleTypes: {
    list: () =>
      getJSON<{ success: boolean; types: string[] }>('/api/lager/article-types'),
    create: (name: string) =>
      postJSON<{ success: boolean; name: string }>('/api/lager/article-types', { name }, 'lager:article-type:create')
  },
  categories: {
    list: () =>
      getJSON<{ success: boolean; categories: Category[] }>('/api/lager/categories'),
    get: (id: string) =>
      getJSON<{ success: boolean; data: Category }>(`/api/lager/categories/${id}`),
    create: (data: { name: string; parentId?: string | null; beschreibung?: string; typ?: string }) =>
      postJSON('/api/lager/categories', data, 'lager:category:create'),
    update: (id: string, data: Partial<Category>) =>
      putJSON(`/api/lager/categories/${id}`, data as Record<string, unknown>, 'lager:category:update'),
    delete: (id: string) =>
      delJSON(`/api/lager/categories/${id}`, 'lager:category:delete')
  },
  movements: {
    list: (params?: { artikelId?: string; bewegungstyp?: string; datumVon?: string; datumBis?: string; lieferscheinId?: string }) => {
      const search = new URLSearchParams()
      if (params?.artikelId) search.set('artikelId', params.artikelId)
      if (params?.bewegungstyp) search.set('bewegungstyp', params.bewegungstyp)
      if (params?.datumVon) search.set('datumVon', params.datumVon)
      if (params?.datumBis) search.set('datumBis', params.datumBis)
      if (params?.lieferscheinId) search.set('lieferscheinId', params.lieferscheinId)
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
      unitIds?: string[]
      evidencePhotos?: Array<{ dataUrl: string; filename?: string; capturedAt?: string | Date }>
    }) =>
      postJSON('/api/lager/movements', data as Record<string, unknown>, 'lager:movement:create')
  },
  recipients: {
    list: () =>
      getJSON<{ success: boolean; recipients: string[]; employees: Array<{ id: string; name: string }> }>('/api/lager/recipients'),
    create: (data: { name: string }) =>
      postJSON<{ success: boolean; recipients: string[]; created?: string }>('/api/lager/recipients', data, 'lager:recipient:create')
  },
  partners: {
    list: () =>
      getJSON<{
        success: boolean
        employees: Array<{ value: string; label: string; partnerType: 'employee'; employeeId: string }>
        suppliers: Array<{ value: string; label: string; partnerType: 'external'; partnerId: string }>
        partners: Array<{
          id: string
          type: 'employee' | 'external'
          label: string
          employeeId?: string
          employeeName?: string
          companyName?: string
          contactName?: string
          phone?: string
          email?: string
          active: boolean
        }>
      }>('/api/lager/partners'),
    create: (data:
      | { type: 'employee'; employeeId: string; contactName?: string; phone?: string; email?: string }
      | { type: 'external'; companyName: string; contactName: string; phone?: string; email?: string }) =>
      postJSON('/api/lager/partners', data as Record<string, unknown>, 'lager:partner:create'),
    update: (id: string, data: {
      type?: 'employee' | 'external'
      employeeId?: string
      companyName?: string
      contactName?: string
      phone?: string
      email?: string
      active?: boolean
    }) =>
      putJSON(`/api/lager/partners/${id}`, data as Record<string, unknown>, 'lager:partner:update')
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
      evidencePhotos?: Array<{ dataUrl: string; filename?: string; capturedAt?: string | Date }>
      createDeliveryNote?: boolean
    }) =>
      postJSON('/api/lager/assignments', data as Record<string, unknown>, 'lager:assignments:create'),
    bulk: (data: {
      personId: string
      ausgabedatum: string | Date
      geplanteRueckgabe?: string | Date | null
      bemerkung?: string
      evidencePhotos?: Array<{ dataUrl: string; filename?: string; capturedAt?: string | Date }>
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
    create: (data: {
      artikelId?: string
      categoryId?: string
      unitId?: string
      wartungsart: string
      faelligkeitsdatum: string | Date
      status?: string
    }) =>
      postJSON('/api/lager/maintenance', data as Record<string, unknown>, 'lager:maintenance:create'),
    update: (id: string, data: { durchfuehrungsdatum?: string | Date | null; status?: string; ergebnis?: string; naechsterTermin?: string | Date | null }) =>
      putJSON(`/api/lager/maintenance/${id}`, data as Record<string, unknown>, 'lager:maintenance:update'),
    delete: (id: string) =>
      delJSON(`/api/lager/maintenance/${id}`, 'lager:maintenance:delete')
  },
  deliveryNotes: {
    list: (params?: {
      typ?: 'eingang' | 'ausgang'
      status?: 'entwurf' | 'abgeschlossen'
      search?: string
      dateFrom?: string
      dateTo?: string
      page?: number
      limit?: number
    }) => {
      const search = new URLSearchParams()
      if (params?.typ) search.set('typ', params.typ)
      if (params?.status) search.set('status', params.status)
      if (params?.search) search.set('search', params.search)
      if (params?.dateFrom) search.set('dateFrom', params.dateFrom)
      if (params?.dateTo) search.set('dateTo', params.dateTo)
      if (typeof params?.page === 'number') search.set('page', String(params.page))
      if (typeof params?.limit === 'number') search.set('limit', String(params.limit))
      const q = search.toString()
      return getJSON<{ success: boolean; deliveryNotes: unknown[]; page?: number; limit?: number }>(`/api/lager/delivery-notes${q ? `?${q}` : ''}`)
    },
    listOpenOutgoing: (recipientName?: string) => {
      const search = new URLSearchParams()
      if (recipientName) search.set('recipient', recipientName)
      const q = search.toString()
      return getJSON<{ success: boolean; deliveryNotes: unknown[] }>(`/api/lager/delivery-notes/open-outgoing${q ? `?${q}` : ''}`)
    },
    get: (id: string) =>
      getJSON<{ success: boolean; data: unknown }>(`/api/lager/delivery-notes/${id}`),
    update: (id: string, data: {
      datum?: string | Date
      status?: 'entwurf' | 'abgeschlossen'
      empfaenger?: { name?: string; adresse?: string }
    }) =>
      putJSON(`/api/lager/delivery-notes/${id}`, data as Record<string, unknown>, 'lager:delivery-note:update'),
    create: (data: {
      typ: 'eingang' | 'ausgang'
      datum: string | Date
      empfaenger: { name: string; adresse?: string }
      positionen: { artikelId: string; bezeichnung: string; menge: number; seriennummer?: string }[]
    }) =>
      postJSON<{ success: boolean; data: { _id?: string; id?: string } }>(
        '/api/lager/delivery-notes',
        data as Record<string, unknown>,
        'lager:delivery-note:create'
      ),
    uploadAttachment: async (
      deliveryNoteId: string,
      payload: { file: File; supplier?: string; reference?: string; noteDate?: string }
    ) => {
      const presignResponse = await postJSON<{
        success: boolean
        uploadUrl: string
        objectKey: string
        bucket: string
        attachmentId: string
      }>(
        `/api/lager/delivery-notes/${deliveryNoteId}/attachments/presign-upload`,
        {
          filename: payload.file.name,
          contentType: payload.file.type || 'application/octet-stream',
          size: payload.file.size
        },
        'lager:delivery-note:attachment:presign'
      )

      const uploadResult = await fetch(presignResponse.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': payload.file.type || 'application/octet-stream' },
        body: payload.file
      })
      if (!uploadResult.ok) {
        throw new Error(`Upload fehlgeschlagen (${uploadResult.status})`)
      }

      return postJSON(
        `/api/lager/delivery-notes/${deliveryNoteId}/attachments/commit`,
        {
          attachmentId: presignResponse.attachmentId,
          objectKey: presignResponse.objectKey,
          bucket: presignResponse.bucket,
          filename: payload.file.name,
          contentType: payload.file.type || 'application/octet-stream',
          size: payload.file.size,
          supplier: payload.supplier ?? '',
          reference: payload.reference ?? '',
          noteDate: payload.noteDate ?? ''
        },
        'lager:delivery-note:attachment:commit'
      )
    },
    deleteAttachment: (deliveryNoteId: string, attachmentId: string) =>
      delJSON(
        `/api/lager/delivery-notes/${deliveryNoteId}/attachments/${attachmentId}`,
        'lager:delivery-note:attachment:delete'
      )
  },
  inventory: {
    list: () =>
      getJSON<{ success: boolean; inventory: unknown[] }>('/api/lager/inventory'),
    get: (id: string) =>
      getJSON<{ success: boolean; data: unknown }>(`/api/lager/inventory/${id}`),
    create: (data: {
      name?: string
      beschreibung?: string
      typ: 'voll' | 'teil'
      stichtag?: string | Date
      zeitraumVon?: string | Date
      zeitraumBis?: string | Date
      artikelIds?: string[]
      kategorien?: string[]
      lagerorte?: string[]
      unitIds?: string[]
    }) =>
      postJSON('/api/lager/inventory', data as Record<string, unknown>, 'lager:inventory:create'),
    update: (id: string, data: {
      name?: string
      beschreibung?: string
      typ?: 'voll' | 'teil'
      kategorien?: string[]
      artikelIds?: string[]
      stichtag?: string | Date
      zeitraumVon?: string | Date | null
      zeitraumBis?: string | Date | null
      positionen?: { artikelId: string; istMenge: number }[]
    }) =>
      putJSON(`/api/lager/inventory/${id}`, data as Record<string, unknown>, 'lager:inventory:update'),
    recordScan: (id: string, data: { artikelId: string; code: string; scannedAt?: string | Date; unitId?: string }) =>
      postJSON(`/api/lager/inventory/${id}/scan`, data as Record<string, unknown>, 'lager:inventory:scan'),
    setScanSession: (id: string, data: {
      action: 'start' | 'end'
      name?: string
      stichtag?: string | Date
      zeitraumVon?: string | Date | null
      zeitraumBis?: string | Date | null
    }) =>
      postJSON(`/api/lager/inventory/${id}/scan-session`, data as Record<string, unknown>, 'lager:inventory:scan-session'),
    delete: (id: string) =>
      delJSON(`/api/lager/inventory/${id}`, 'lager:inventory:delete'),
    complete: (id: string) =>
      postJSON(`/api/lager/inventory/${id}/complete`, {}, 'lager:inventory:complete')
  }
}

