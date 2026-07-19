import { getJSON, putJSON } from '@/lib/http/apiClient'

type SessionResponse = { user?: { id: string; email: string; name: string; role?: string; lastLogin?: string; phone?: string } | null }
type MeResponse = { ok?: boolean; user?: { id: string; email: string; name: string; role?: string; lastLogin?: string; phone?: string }; error?: string }

export const AuthApi = {
  session: () => getJSON<SessionResponse>('/api/auth/session'),
  me: () => getJSON<MeResponse>('/api/auth/me'),
  // Logout läuft über NextAuth `signOut()` (siehe Sidebar), nicht über eine eigene Route.
  updateProfile: (body: { name?: string; email?: string; phone?: string }) =>
    putJSON<{ ok?: boolean; user?: any; error?: string }>('/api/auth/update-profile', body, 'auth:update-profile'),
}


