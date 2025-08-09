import { getJSON, postJSON } from '@/lib/http/apiClient'

export type ActivityLog = {
  id: string
  timestamp: string
  actionType: string
  module: string
  performedBy: { userId: string; name: string; role: string }
  details: { entityId?: string; description: string; before?: any; after?: any; context?: any }
}

export type ActivityLogResponse = {
  success: boolean
  logs: ActivityLog[]
  pagination: { page: number; limit: number; total: number; pages: number }
}

export const ActivityLogApi = {
  list: (params: URLSearchParams | string) =>
    getJSON<ActivityLogResponse>(`/api/activity-log?${params.toString?.() ?? params}`),
  create: (body: { actionType: string; module: string; details: Record<string, any> }) =>
    postJSON<{ success: boolean; message?: string; error?: string }>(
      '/api/activity-log/create',
      body,
      'activity:create'
    ),
  createPDFExport: (body: { module: string; entityId?: string; entityName?: string; exportType: string; details?: any }) =>
    postJSON<{ success: boolean; message?: string; error?: string }>(
      '/api/activity-log/pdf-export',
      body,
      'activity:pdf-export'
    ),
}


