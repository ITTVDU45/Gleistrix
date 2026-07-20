import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/dbConnect'
import InviteToken from '@/lib/models/InviteToken'
import { hashInviteToken } from '@/lib/subunternehmen/inviteToken'
import { acceptSubcontractorInvite } from '@/lib/subunternehmen/acceptInvite'
import { logger } from '@/lib/logger'

/**
 * Annahme einer Subunternehmen-Einladung im Portal: Konto anlegen bzw.
 * verknüpfen + Membership aktivieren (Logik in @gleistrix/shared).
 */
export async function POST(req: NextRequest) {
  try {
    await dbConnect()

    const body = await req.json()
    const { token, password } = body

    if (!token) {
      return NextResponse.json({ error: 'Token ist erforderlich' }, { status: 400 })
    }

    const invite = await InviteToken.findOne({
      tokenHash: hashInviteToken(String(token)),
      invitationType: 'SUBCONTRACTOR',
    })
    if (!invite) {
      return NextResponse.json({ error: 'Ungültiger oder abgelaufener Token' }, { status: 400 })
    }

    return acceptSubcontractorInvite(invite, password)
  } catch (error) {
    logger.error('Portal: Einladungsannahme fehlgeschlagen', error)
    return NextResponse.json(
      { error: 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.' },
      { status: 500 }
    )
  }
}
