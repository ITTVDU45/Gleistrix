import { getJSON, postJSON, delJSON } from '@/lib/http/apiClient'

export type Invite = {
  id: string
  email: string
  name?: string
  firstName?: string
  lastName?: string
  phone?: string
  role: 'admin' | 'user'
  used: boolean
  expiresAt: string
  createdAt: string
  createdBy: string
}

export const InvitesApi = {
  list: () => getJSON<{ invites: Invite[] }>('/api/invite/list'),
  deleteAllForEmail: (email: string) => delJSON<{ message?: string; error?: string }>(`/api/invite/delete-all`, 'invite:delete-all', {
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  }),
  createUser: (payload: { firstName: string; lastName: string; email: string; phone?: string; role: 'user' | 'admin' }) =>
    postJSON<{ message?: string; error?: string }>(`/api/invite/${payload.role === 'admin' ? 'create-admin' : 'create-user'}`, payload, payload.role === 'admin' ? 'invite:create-admin' : 'invite:create-user'),
}


