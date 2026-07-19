import { getJSON, postJSON, putJSON, delJSON } from '@/lib/http/apiClient'
import type { Employee } from '@/types/main'

/** Die API liefert Mongo-Dokumente, d. h. zusätzlich zum `id` auch `_id`. */
export type ApiEmployee = Employee & { _id?: string }

export interface EmployeeListResponse {
  success: boolean
  employees?: ApiEmployee[]
  message?: string
}

export interface EmployeeItemResponse {
  success?: boolean
  employee?: ApiEmployee
  data?: ApiEmployee
  message?: string
}

export interface EmployeeMutationResponse {
  success: boolean
  message?: string
}

export const EmployeesApi = {
  list: () => getJSON<EmployeeListResponse>('/api/employees'),
  get: (id: string) => getJSON<{ success?: boolean; employee: ApiEmployee }>(`/api/employees/${id}`),
  create: (data: Partial<Employee>) => postJSON<EmployeeItemResponse>('/api/employees', data, 'employees:create'),
  update: (id: string, data: Partial<Employee>) => putJSON<EmployeeItemResponse>(`/api/employees/${id}`, data, 'employees:update'),
  remove: (id: string) => delJSON<EmployeeMutationResponse>(`/api/employees/${id}`, 'employees:delete'),
}
