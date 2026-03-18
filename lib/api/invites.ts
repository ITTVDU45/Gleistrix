import { getJSON, delJSON } from '@/lib/http/apiClient'
import { fetchWithIntent } from '@/lib/http/fetchWithIntent'

export type Invite = {
  id: string
  email: string
  name?: string
  firstName?: string
  lastName?: string
  phone?: string
  role: 'admin' | 'user' | 'lager'
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
  createUser: async (payload: { firstName: string; lastName: string; email: string; phone?: string; role: 'user' | 'admin' | 'lager'; resend?: boolean; modules?: string[] }) => {
    const url = `/api/invite/${payload.role === 'admin' ? 'create-admin' : 'create-user'}`
    const intent = payload.role === 'admin' ? 'invite:create-admin' : 'invite:create-user'
    const res = await fetchWithIntent(url, {
      method: 'POST',
      intent,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const text = await res.text().catch(() => '')
    const json = (() => {
      try {
        return text ? JSON.parse(text) : {}
      } catch {
        return {}
      }
    })() as { message?: string; error?: string; emailSent?: boolean; emailError?: string }

    // Wichtig: 409/400 usw. NICHT werfen, damit UI es sauber anzeigen kann
    return json
  },
  /** Admin aktiviert ausstehende Einladung mit Passwort (erstellt User, markiert Token als verwendet). */
  activateUser: async (payload: { email: string; password: string }) => {
    const res = await fetchWithIntent('/api/invite/activate-user', {
      method: 'POST',
      intent: 'invite:activate-user',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const text = await res.text().catch(() => '')
    const json = (() => {
      try {
        return text ? JSON.parse(text) : {}
      } catch {
        return {}
      }
    })() as { message?: string; error?: string }
    if (!res.ok) {
      return { error: json.error || 'Aktivierung fehlgeschlagen', ...json }
    }
    return json
  },
}


