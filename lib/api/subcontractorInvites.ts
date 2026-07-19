import { getJSON, postJSON, delJSON } from '@/lib/http/apiClient'
import type { SubcontractorPermission, SubcontractorRole } from '@/types/subunternehmen'

export interface SubcontractorInvite {
  id: string
  email: string
  name?: string
  companyId: string
  companyName: string
  subcontractorRole: SubcontractorRole
  status: 'pending' | 'accepted' | 'expired' | 'cancelled'
  expiresAt: string
  acceptedAt?: string
  createdAt: string
}

export interface CreateSubcontractorInvitePayload {
  subcontractorCompanyId?: string
  newCompany?: {
    name: string
    employeeCount?: number
    email?: string
    phone?: string
    address?: string
  }
  firstName: string
  lastName: string
  email: string
  phone?: string
  subcontractorRole: SubcontractorRole
  permissions?: SubcontractorPermission[]
  resend?: boolean
}

export const SubcontractorInvitesApi = {
  list: () => getJSON<{ invites: SubcontractorInvite[] }>('/api/invite/subcontractor'),
  create: (payload: CreateSubcontractorInvitePayload) =>
    postJSON<{ message?: string; error?: string; emailSent?: boolean; invite?: SubcontractorInvite }>(
      '/api/invite/subcontractor',
      payload as unknown as Record<string, unknown>,
      'invite:subcontractor-create'
    ),
  revoke: (id: string) =>
    delJSON<{ message?: string; error?: string }>(`/api/invite/subcontractor/${id}`, 'invite:subcontractor-revoke'),
}
