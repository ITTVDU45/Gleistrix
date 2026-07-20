import { NextResponse } from 'next/server'
import { hash } from 'bcryptjs'
import User from '@/lib/models/User'
import { Subcompany } from '@/lib/models/Subcompany'
import SubcontractorMembership from '@/lib/models/SubcontractorMembership'
import NotificationLog from '@/lib/models/NotificationLog'
import { validateInviteState } from '@/lib/subunternehmen/inviteToken'
import { logSubcontractorActivity } from '@/lib/subunternehmen/audit'
import { sendEmailResult } from '@/lib/mailer'
import { logger } from '@/lib/logger'

/**
 * Annahme einer Subunternehmen-Einladung: Benutzer anlegen ODER bestehendes
 * Konto verknüpfen, Membership aktivieren, Token einmalig entwerten,
 * Einladenden benachrichtigen. Wird von der Admin-App (Alt-Links) und der
 * Portal-App (neue Links) identisch genutzt.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function acceptSubcontractorInvite(inviteToken: any, password: string | undefined) {
  const state = validateInviteState(inviteToken)
  if (!state.valid) {
    const message = state.reason === 'revoked'
      ? 'Diese Einladung wurde widerrufen'
      : state.reason === 'used'
        ? 'Diese Einladung wurde bereits verwendet'
        : 'Diese Einladung ist abgelaufen'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  const company = await Subcompany.findById(inviteToken.subcontractorCompanyId)
  if (!company) {
    return NextResponse.json({ error: 'Subunternehmen nicht gefunden' }, { status: 404 })
  }
  if (company.status === 'blocked' || company.status === 'inactive') {
    return NextResponse.json({ error: 'Dieses Subunternehmen ist deaktiviert' }, { status: 403 })
  }

  // Vorhandenen Benutzer erkennen und verknüpfen statt Duplikat anzulegen
  let user = await User.findOne({ email: inviteToken.email })
  let createdNewUser = false

  if (user) {
    if (user.role !== 'subunternehmen') {
      return NextResponse.json(
        { error: 'Ein interner Benutzer mit dieser E-Mail existiert bereits' },
        { status: 409 }
      )
    }
    const existingMembership = await SubcontractorMembership.findOne({ userId: user._id })
    if (existingMembership) {
      // Keine doppelte Membership – Einladung trotzdem entwerten
      inviteToken.used = true
      inviteToken.acceptedAt = new Date()
      await inviteToken.save()
      return NextResponse.json(
        { error: 'Dieser Benutzer ist bereits einem Subunternehmen zugeordnet' },
        { status: 409 }
      )
    }
  } else {
    if (!password || password.length < 6) {
      return NextResponse.json(
        { error: 'Passwort muss mindestens 6 Zeichen lang sein' },
        { status: 400 }
      )
    }
    const hashedPassword = await hash(password, 12)
    const fullName = inviteToken.name || `${inviteToken.firstName || ''} ${inviteToken.lastName || ''}`.trim()
    user = new User({
      email: inviteToken.email,
      name: fullName,
      password: hashedPassword,
      role: 'subunternehmen',
      firstName: inviteToken.firstName,
      lastName: inviteToken.lastName,
      phone: inviteToken.phone,
      isActive: true,
      ...(inviteToken.createdBy ? { createdBy: inviteToken.createdBy } : {}),
      modules: [],
    })
    await user.save()
    createdNewUser = true
  }

  const membership = await SubcontractorMembership.create({
    subcontractorCompanyId: company._id,
    userId: user._id,
    role: inviteToken.subcontractorRole || 'SUBCONTRACTOR_OWNER',
    permissions: inviteToken.subcontractorPermissions || [],
    status: 'active',
    invitedByUserId: inviteToken.createdBy,
    invitedAt: inviteToken.createdAt,
    acceptedAt: new Date(),
  })

  // Token einmalig entwerten
  inviteToken.used = true
  inviteToken.acceptedAt = new Date()
  await inviteToken.save()

  await logSubcontractorActivity({
    actionType: 'subcontractor_invite_accepted',
    description: `Subunternehmen-Einladung angenommen: ${inviteToken.email} (${company.name})`,
    userId: user._id,
    userName: user.name || inviteToken.email,
    userRole: 'subunternehmen',
    entityId: inviteToken._id,
    subcontractorCompanyId: company._id,
  })
  await logSubcontractorActivity({
    actionType: 'subcontractor_membership_created',
    description: `Membership erstellt: ${user.email} → ${company.name} (${membership.role})`,
    userId: user._id,
    userName: user.name || inviteToken.email,
    userRole: 'subunternehmen',
    entityId: membership._id,
    subcontractorCompanyId: company._id,
  })

  // Interne Benachrichtigung an den Einladenden (best effort)
  try {
    let inviterEmail: string | undefined
    if (inviteToken.createdBy) {
      const inviter = await User.findById(inviteToken.createdBy).select('email').lean() as { email?: string } | null
      inviterEmail = inviter?.email
    }
    const to = inviterEmail || process.env.RECEIVED_INVOICES_EMAIL || process.env.ABBRECHNUNG_EMAIL
    if (to) {
      const subject = `Einladung angenommen: ${company.name} (${user.email})`
      const emailResult = await sendEmailResult({
        to,
        subject,
        html: `
          <div style="font-family: Arial, sans-serif; color: #111;">
            <h2 style="font-size:17px">Subunternehmen-Einladung angenommen</h2>
            <p><strong>${user.name || user.email}</strong> hat die Portal-Einladung für
            <strong>${company.name}</strong> angenommen und kann sich jetzt anmelden.</p>
          </div>
        `,
      })
      await NotificationLog.create({
        key: 'Subunternehmen-Einladung angenommen',
        to,
        subject,
        success: emailResult.ok,
        errorMessage: emailResult.error,
        meta: { companyId: String(company._id), userEmail: user.email },
      })
    }
  } catch (notifyError) {
    logger.warn('Benachrichtigung über angenommene Einladung fehlgeschlagen', notifyError)
  }

  return NextResponse.json({
    message: createdNewUser
      ? 'Benutzer erfolgreich erstellt'
      : 'Bestehendes Konto wurde mit dem Subunternehmen verknüpft',
    invitationType: 'SUBCONTRACTOR',
    user: {
      email: user.email,
      name: user.name,
      role: user.role,
    },
    company: { id: String(company._id), name: company.name },
  }, { status: 201 })
}
