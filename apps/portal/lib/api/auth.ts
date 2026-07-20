import { getJSON } from '@/lib/http/apiClient'

type MeResponse = {
  user?: { id: string; email: string; name: string; role?: string; phone?: string; lastLogin?: string }
  error?: string
}

export const AuthApi = {
  me: () => getJSON<MeResponse>('/api/auth/me'),
}
