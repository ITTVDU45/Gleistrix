import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/dbConnect'
import InviteToken from '@/lib/models/InviteToken'
import User from '@/lib/models/User'
import { Subcompany } from '@/lib/models/Subcompany'
import { hashInviteToken, validateInviteState } from '@/lib/subunternehmen/inviteToken'
import { logger } from '@/lib/logger'

/** Validiert Subunternehmen-Einladungslinks (Lookup ausschließlich über Hash). */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token')

  if (!token) {
    return NextResponse.json({ error: 'Token erforderlich' }, { status: 400 })
  }

  try {
    await dbConnect()

    const invite = await InviteToken.findOne({
      tokenHash: hashInviteToken(token),
      invitationType: 'SUBCONTRACTOR',
    })

    if (!invite) {
      return NextResponse.json({ error: 'Ungültiger oder abgelaufener Token' }, { status: 400 })
    }

    const state = validateInviteState(invite)
    if (!state.valid) {
      const message = state.reason === 'revoked'
        ? 'Diese Einladung wurde widerrufen'
        : state.reason === 'used'
          ? 'Diese Einladung wurde bereits verwendet'
          : 'Diese Einladung ist abgelaufen'
      return NextResponse.json({ error: message }, { status: 400 })
    }

    const company = invite.subcontractorCompanyId
      ? await Subcompany.findById(invite.subcontractorCompanyId).select('name').lean() as { name?: string } | null
      : null
    const existingUser = await User.findOne({ email: invite.email }).select('email').lean()

    return NextResponse.json({
      valid: true,
      email: invite.email,
      name: invite.name,
      role: invite.role,
      invitationType: 'SUBCONTRACTOR',
      companyName: company?.name || '',
      subcontractorRole: invite.subcontractorRole,
      existingUser: Boolean(existingUser),
      expiresAt: invite.expiresAt,
    })
  } catch (error) {
    logger.error('Portal: Token-Validierung fehlgeschlagen', error)
    return NextResponse.json(
      { error: 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.' },
      { status: 500 }
    )
  }
}
