import { getJSON, postJSON, putJSON, delJSON } from '@/lib/http/apiClient'
import type { Subcompany } from '@/types/main'

export const SubcompaniesApi = {
  list: () => getJSON<{ success: boolean; subcompanies: Subcompany[] }>('/api/subcompanies'),
  create: (data: Partial<Subcompany>) => postJSON('/api/subcompanies', data, 'subcompanies:create'),
  update: (id: string, data: Partial<Subcompany>) => putJSON(`/api/subcompanies/${id}`, data, 'subcompanies:update'),
  remove: (id: string) => delJSON(`/api/subcompanies/${id}`, 'subcompanies:delete'),
}
