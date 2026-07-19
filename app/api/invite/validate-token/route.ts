import { NextRequest, NextResponse } from "next/server"
import dbConnect from "../../../../lib/dbConnect"
import InviteToken from "../../../../lib/models/InviteToken"
import User from "../../../../lib/models/User"
import { Subcompany } from "../../../../lib/models/Subcompany"
import { hashInviteToken, validateInviteState } from "../../../../lib/subunternehmen/inviteToken"
import { logger } from "../../../../lib/logger"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.json({ error: "Token erforderlich" }, { status: 400 });
  }

  try {
    await dbConnect();

    // Neuer, sicherer Weg: Subunternehmen-Einladungen werden über den
    // SHA-256-Hash des Tokens gefunden (Klartext liegt nie in der DB).
    const tokenHash = hashInviteToken(token);
    const subcontractorInvite = await InviteToken.findOne({
      tokenHash,
      invitationType: 'SUBCONTRACTOR',
    });

    if (subcontractorInvite) {
      const state = validateInviteState(subcontractorInvite);
      if (!state.valid) {
        const message = state.reason === 'revoked'
          ? 'Diese Einladung wurde widerrufen'
          : state.reason === 'used'
            ? 'Diese Einladung wurde bereits verwendet'
            : 'Diese Einladung ist abgelaufen';
        return NextResponse.json({ error: message }, { status: 400 });
      }

      const company = subcontractorInvite.subcontractorCompanyId
        ? await Subcompany.findById(subcontractorInvite.subcontractorCompanyId).select('name').lean() as { name?: string } | null
        : null;
      const existingUser = await User.findOne({ email: subcontractorInvite.email }).select('email').lean();

      return NextResponse.json({
        valid: true,
        email: subcontractorInvite.email,
        name: subcontractorInvite.name,
        role: subcontractorInvite.role,
        invitationType: 'SUBCONTRACTOR',
        companyName: company?.name || '',
        subcontractorRole: subcontractorInvite.subcontractorRole,
        /** Bestehendes Konto wird verknüpft – kein neues Passwort nötig */
        existingUser: Boolean(existingUser),
        expiresAt: subcontractorInvite.expiresAt,
      }, { status: 200 });
    }

    // Alt-Flow: interne Einladungen mit Klartext-Token.
    // SUBCONTRACTOR wird hier explizit ausgeschlossen, damit ein geleakter
    // Hash niemals als Token einlösbar ist.
    const inviteToken = await InviteToken.findOne({
      token,
      invitationType: { $ne: 'SUBCONTRACTOR' },
      used: false,
      expiresAt: { $gt: new Date() }
    });

    if (!inviteToken) {
      return NextResponse.json({
        error: "Ungültiger oder abgelaufener Token"
      }, { status: 400 });
    }

    return NextResponse.json({
      valid: true,
      email: inviteToken.email,
      name: inviteToken.name,
      role: inviteToken.role,
      invitationType: inviteToken.invitationType || 'INTERNAL_USER',
      expiresAt: inviteToken.expiresAt
    }, { status: 200 });

  } catch (error) {
    logger.error('Validate token error', error);
    return NextResponse.json({
      error: "Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut."
    }, { status: 500 });
  }
}
