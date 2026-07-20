import { getJSON, postJSON } from '@/lib/http/apiClient'

export const SetupApi = {
  status: () => getJSON<{ available: boolean }>('/api/setup/status'),
  createSuperadmin: (body: Record<string, unknown>) =>
    postJSON<{ message?: string; error?: string }>('/api/setup/create-superadmin', body),
  sendWelcomeEmail: () => postJSON<{ message?: string; user?: any; error?: string }>(
    '/api/setup/send-welcome-email',
    {}
  ),
}


