import { getJSON, postJSON, putJSON, delJSON } from '@/lib/http/apiClient'

export type ExistingUser = {
  id: string
  email: string
  name: string
  role: 'superadmin' | 'admin' | 'user' | 'lager'
  firstName?: string
  lastName?: string
  phone?: string
  isActive: boolean
  lastLogin?: string
  createdAt: string
  modules?: string[]
}

export const UsersApi = {
  list: () => getJSON<{ users: ExistingUser[] }>('/api/users'),
  remove: (id: string) => delJSON<{ success?: boolean; message?: string; error?: string }>(`/api/users/${id}`),
  toggleStatus: (id: string, isActive: boolean) =>
    putJSON<{ success?: boolean; message?: string; error?: string }>(`/api/users/${id}/toggle-status`, { isActive }, 'employees:update'),
  updateRole: (id: string, role: 'superadmin' | 'admin' | 'user' | 'lager') =>
    putJSON<{ message?: string; error?: string }>(`/api/users/${id}/update-role`, { role }, 'users:update-role'),
  update: (id: string, data: {
    firstName?: string; lastName?: string; email?: string; phone?: string;
    role?: 'admin' | 'user' | 'lager'; modules?: string[]; isActive?: boolean;
  }) => putJSON<{ message?: string; error?: string; user?: ExistingUser }>(`/api/users/${id}`, data, 'users:update'),
}
