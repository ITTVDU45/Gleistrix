import { getJSON, postJSON, putJSON, delJSON } from '@/lib/http/apiClient'
import type { Employee } from '@/types/main'

export const EmployeesApi = {
  list: () => getJSON<{ success: boolean; employees: Employee[] }>('/api/employees'),
  get: (id: string) => getJSON<{ success?: boolean; employee: Employee }>(`/api/employees/${id}`),
  create: (data: Partial<Employee>) => postJSON('/api/employees', data, 'employees:create'),
  update: (id: string, data: Partial<Employee>) => putJSON(`/api/employees/${id}`, data, 'employees:update'),
  remove: (id: string) => delJSON(`/api/employees/${id}`, 'employees:delete'),
}


