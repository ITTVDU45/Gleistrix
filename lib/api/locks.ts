import { getJSON, postJSON } from '@/lib/http/apiClient'

type ResourceType = 'project' | 'employee' | 'vehicle'

export type LockCheckResponse = {
  success: boolean
  isLocked: boolean
  isOwnLock: boolean
  error?: string
  lock?: {
    id: string
    resourceType: ResourceType
    resourceId: string
    lockedBy: { userId: string; name: string; role: string }
    lockedAt: string
    lastActivity: string
  } | null
}

export type AcquireLockResponse = {
  success: boolean
  message?: string
  error?: string
  lock?: { lockedBy: { userId: string; name: string; role: string } }
  lockedBy?: { userId: string; name: string; role: string }
}

export type ReleaseLockResponse = {
  success: boolean
  message?: string
  releasedCount?: number
  error?: string
}

export const LocksApi = {
  check: (resourceType: ResourceType, resourceId: string) =>
    getJSON<LockCheckResponse>(`/api/locks/check?resourceType=${resourceType}&resourceId=${resourceId}`),

  acquire: (resourceType: ResourceType, resourceId: string) =>
    postJSON<AcquireLockResponse>(`/api/locks/acquire`, { resourceType, resourceId }),

  release: (resourceType: ResourceType, resourceId: string) =>
    postJSON<ReleaseLockResponse>(`/api/locks/release`, { resourceType, resourceId }),

  updateActivity: (resourceType: ResourceType, resourceId: string) =>
    postJSON<{ success: boolean; updated: boolean }>(`/api/locks/update-activity`, { resourceType, resourceId }),
}


