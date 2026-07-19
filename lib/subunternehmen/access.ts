import { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import mongoose from 'mongoose'
import dbConnect from '@/lib/dbConnect'
import SubcontractorMembership from '@/lib/models/SubcontractorMembership'
import { Subcompany } from '@/lib/models/Subcompany'
import { isFeatureEnabled } from '@/lib/featureFlags'
import { effectivePermissions } from '@/lib/subunternehmen/permissions'
import type { SubcontractorPermission, SubcontractorRole } from '@/types/subunternehmen'

export interface SubcontractorContext {
  userId: mongoose.Types.ObjectId
  userName: string
  userEmail?: string
  companyId: mongoose.Types.ObjectId
  companyName: string
  company: Record<string, any>
  membershipId: mongoose.Types.ObjectId
  role: SubcontractorRole
  permissions: SubcontractorPermission[]
}

export type SubcontractorAuthResult =
  | { ok: true; ctx: SubcontractorContext }
  | { ok: false; status: number; error: string }

/**
 * Zentrale serverseitige Autorisierung für alle Portal-Endpunkte.
 * Prüft: Session → Rolle → Feature-Flag → aktive Membership → aktiver
 * Unternehmens-Status → (optionale) granulare Permission.
 * Scoping erfolgt ausschließlich über die Membership (IDOR-Schutz) –
 * niemals über IDs aus Query/Body.
 */
export async function requireSubcontractor(
  req: NextRequest,
  permission?: SubcontractorPermission
): Promise<SubcontractorAuthResult> {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  if (!token?.id) return { ok: false, status: 401, error: 'Nicht angemeldet' }
  if ((token as { role?: string }).role !== 'subunternehmen') {
    return { ok: false, status: 403, error: 'Keine Berechtigung' }
  }

  if (!(await isFeatureEnabled('subcontractorPortalEnabled'))) {
    return { ok: false, status: 403, error: 'Das Subunternehmen-Portal ist derzeit deaktiviert' }
  }

  await dbConnect()

  let userId: mongoose.Types.ObjectId
  try {
    userId = new mongoose.Types.ObjectId(String(token.id))
  } catch {
    return { ok: false, status: 401, error: 'Ungültige Sitzung' }
  }

  // Deaktivierte Benutzer verlieren sofort den Zugriff (nicht erst bei Token-Ablauf)
  const db = mongoose.connection.db
  const userDoc = db ? await db.collection('users').findOne({ _id: userId }) : null
  if (!userDoc || userDoc.isActive === false) {
    return { ok: false, status: 403, error: 'Benutzerkonto ist deaktiviert' }
  }

  const membership = await SubcontractorMembership.findOne({ userId, status: 'active' }).lean() as {
    _id: mongoose.Types.ObjectId
    subcontractorCompanyId: mongoose.Types.ObjectId
    role: SubcontractorRole
    permissions?: string[]
  } | null
  if (!membership) {
    return { ok: false, status: 403, error: 'Keine aktive Subunternehmen-Mitgliedschaft' }
  }

  const company = await Subcompany.findById(membership.subcontractorCompanyId).lean() as Record<string, any> | null
  if (!company) {
    return { ok: false, status: 403, error: 'Subunternehmen nicht gefunden' }
  }
  if (company.status === 'blocked' || company.status === 'inactive') {
    return { ok: false, status: 403, error: 'Subunternehmen ist deaktiviert' }
  }

  const permissions = effectivePermissions(membership)
  if (permission && !permissions.includes(permission)) {
    return { ok: false, status: 403, error: 'Keine Berechtigung für diese Aktion' }
  }

  return {
    ok: true,
    ctx: {
      userId,
      userName: String(token.name || token.email || 'Unbekannt'),
      userEmail: typeof token.email === 'string' ? token.email : undefined,
      companyId: membership.subcontractorCompanyId,
      companyName: String(company.name || ''),
      company,
      membershipId: membership._id,
      role: membership.role,
      permissions,
    },
  }
}
