import { NextRequest, NextResponse } from 'next/server'
import { hasValidCsrfIntent } from '@/lib/security/requireCsrfIntent'
import mongoose from 'mongoose'
import dbConnect from '@/lib/dbConnect'
import InviteToken from '@/lib/models/InviteToken'
import { Subcompany } from '@/lib/models/Subcompany'
import { requireAdminUser } from '@/lib/auth/requireAdminUser'
import { logSubcontractorActivity } from '@/lib/subunternehmen/audit'
import { logger } from '@/lib/logger'

/** Widerruft eine Subunternehmen-Einladung (nur Admins). */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const adminAuth = await requireAdminUser(req)
    if (!adminAuth.ok) {
      return NextResponse.json({ error: adminAuth.error }, { status: adminAuth.status })
    }
    if (!hasValidCsrfIntent(req, 'invite:subcontractor-revoke')) {
      return NextResponse.json({ error: 'Ungültige Anforderung' }, { status: 400 })
    }
    await dbConnect()

    const { id } = await params
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json({ error: 'Ungültige Einladungs-ID' }, { status: 400 })
    }

    const invite = await InviteToken.findOne({ _id: id, invitationType: 'SUBCONTRACTOR' })
    if (!invite) {
      return NextResponse.json({ error: 'Einladung nicht gefunden' }, { status: 404 })
    }
    if (invite.used) {
      return NextResponse.json({ error: 'Einladung wurde bereits angenommen' }, { status: 409 })
    }
    if (invite.revokedAt) {
      return NextResponse.json({ message: 'Einladung war bereits widerrufen' })
    }

    invite.revokedAt = new Date()
    await invite.save()

    const company = invite.subcontractorCompanyId
      ? await Subcompany.findById(invite.subcontractorCompanyId).select('name').lean() as { name?: string } | null
      : null

    await logSubcontractorActivity({
      actionType: 'subcontractor_invite_revoked',
      description: `Subunternehmen-Einladung widerrufen: ${invite.email}${company?.name ? ` (${company.name})` : ''}`,
      userId: adminAuth.user.id,
      userName: adminAuth.user.name,
      userRole: adminAuth.user.role,
      entityId: invite._id,
      subcontractorCompanyId: invite.subcontractorCompanyId,
    })

    return NextResponse.json({ message: 'Einladung widerrufen' })
  } catch (error) {
    logger.error('Einladung konnte nicht widerrufen werden', error)
    return NextResponse.json({ error: 'Fehler beim Widerrufen der Einladung' }, { status: 500 })
  }
}
