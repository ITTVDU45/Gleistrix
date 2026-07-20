import { getJSON, postJSON, putJSON, delJSON } from '@/lib/http/apiClient'
import type { Subcompany } from '@/types/main'

/** Die API liefert Mongo-Dokumente, d. h. zusätzlich zum `id` auch `_id`. */
export type ApiSubcompany = Subcompany & { _id?: string }

export interface SubcompanyListResponse {
  success?: boolean
  subcompanies?: ApiSubcompany[]
  message?: string
}

export interface SubcompanyItemResponse {
  success?: boolean
  subcompany?: ApiSubcompany
  data?: ApiSubcompany
  message?: string
}

export interface SubcompanyMutationResponse {
  success?: boolean
  message?: string
}

export const SubcompaniesApi = {
  list: () => getJSON<SubcompanyListResponse>('/api/subcompanies'),
  create: (data: Partial<Subcompany>) => postJSON<SubcompanyItemResponse>('/api/subcompanies', data, 'subcompanies:create'),
  update: (id: string, data: Partial<Subcompany>) => putJSON<SubcompanyItemResponse>(`/api/subcompanies/${id}`, data, 'subcompanies:update'),
  remove: (id: string) => delJSON<SubcompanyMutationResponse>(`/api/subcompanies/${id}`, 'subcompanies:delete'),
}
