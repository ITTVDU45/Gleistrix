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
      delJSON(`/api/lager/articles/${id}`, 'lager:article:delete'),
    uploadImage: async (articleId: string, file: File) => {
      const presignResponse = await postJSON<{
        success: boolean
        uploadUrl: string
        objectKey: string
        bucket: string
        attachmentId: string
      }>(
        `/api/lager/articles/${articleId}/images/presign-upload`,
        {
          filename: file.name,
          contentType: file.type || 'image/jpeg',
          size: file.size
        },
        'lager:article:image:presign'
      )
      if (!presignResponse?.uploadUrl) throw new Error('Presign fehlgeschlagen')
      const uploadResult = await fetch(presignResponse.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'image/jpeg' },
        body: file
      })
      if (!uploadResult.ok) throw new Error(`Upload fehlgeschlagen (${uploadResult.status})`)
      return postJSON(
        `/api/lager/articles/${articleId}/images/commit`,
        {
          attachmentId: presignResponse.attachmentId,
          objectKey: presignResponse.objectKey,
          bucket: presignResponse.bucket,
          filename: file.name,
          contentType: file.type || 'image/jpeg',
          size: file.size
        },
        'lager:article:image:commit'
      )
    },
    getImageUrl: (articleId: string, attachmentId: string) =>
      getJSON<{ success: boolean; url: string }>(
        `/api/lager/articles/${articleId}/images/${attachmentId}/presign`
      ),
    deleteImage: (articleId: string, attachmentId: string) =>
      delJSON(
        `/api/lager/articles/${articleId}/images/${attachmentId}`,
        'lager:article:image:delete'
      )
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
    recordScan: (id: string, data: { artikelId: string; code: string; scannedAt?: string | Date }) =>
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

