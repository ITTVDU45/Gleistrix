import type { SubcontractorPermission, SubcontractorRole } from '@/types/subunternehmen'

export const ALL_SUBCONTRACTOR_PERMISSIONS: SubcontractorPermission[] = [
  'subcontractor.projects.read',
  'subcontractor.assignments.read',
  'subcontractor.documents.read',
  'subcontractor.documents.upload',
  'subcontractor.invoices.read',
  'subcontractor.invoices.create',
  'subcontractor.invoices.submit',
  'subcontractor.company.update',
]

/** OWNER hat immer alle Rechte */
export const OWNER_PERMISSIONS: SubcontractorPermission[] = [...ALL_SUBCONTRACTOR_PERMISSIONS]

/** Defaults für SUBCONTRACTOR_USER ohne explizite Permission-Auswahl */
export const DEFAULT_USER_PERMISSIONS: SubcontractorPermission[] = [
  'subcontractor.projects.read',
  'subcontractor.assignments.read',
  'subcontractor.documents.read',
  'subcontractor.documents.upload',
  'subcontractor.invoices.read',
  'subcontractor.invoices.create',
]

export interface MembershipLike {
  role: SubcontractorRole
  permissions?: string[] | null
}

/** Effektive Permissions einer Membership (OWNER = alles, USER = Auswahl oder Defaults). */
export function effectivePermissions(membership: MembershipLike): SubcontractorPermission[] {
  if (membership.role === 'SUBCONTRACTOR_OWNER') return OWNER_PERMISSIONS
  const explicit = (membership.permissions ?? []).filter((p): p is SubcontractorPermission =>
    (ALL_SUBCONTRACTOR_PERMISSIONS as string[]).includes(p)
  )
  return explicit.length > 0 ? explicit : DEFAULT_USER_PERMISSIONS
}

export function hasSubcontractorPermission(
  membership: MembershipLike,
  permission: SubcontractorPermission
): boolean {
  return effectivePermissions(membership).includes(permission)
}
