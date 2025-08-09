import { getJSON, putJSON } from '@/lib/http/apiClient'

export type NotificationSettings = {
  definitions: Record<string, any>
  enabledByKey: Record<string, boolean>
  configByKey: Record<string, any>
}

export type NotificationLogsResponse = {
  logs: Array<{
    id: string
    timestamp: string
    key: string
    to: string
    subject?: string
    attachmentsCount?: number
    projectName?: string
    success?: boolean
    errorMessage?: string | null
    performedBy?: string | null
  }>
}

export const NotificationsApi = {
  getSettings: () => getJSON<NotificationSettings & { success?: boolean }>(`/api/notifications`),
  updateSettings: (body: { enabledByKey: Record<string, boolean>; configByKey: Record<string, any> }) =>
    putJSON(`/api/notifications`, body),
  listLogs: () => getJSON<NotificationLogsResponse>(`/api/notifications/logs`),
}


