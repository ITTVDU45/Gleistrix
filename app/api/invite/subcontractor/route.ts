import { NextRequest, NextResponse } from 'next/server'
import { getRequestBaseUrl } from '@/lib/http/requestBaseUrl'
import { hasValidCsrfIntent } from '@/lib/security/requireCsrfIntent'
import { z } from 'zod'
import dbConnect from '@/lib/dbConnect'
import InviteToken from '@/lib/models/InviteToken'
import User from '@/lib/models/User'
import { Subcompany } from '@/lib/models/Subcompany'
import SubcontractorMembership from '@/lib/models/SubcontractorMembership'
import { requireAdminUser } from '@/lib/auth/requireAdminUser'
import { resolveInviteCreatorId } from '@/lib/auth/resolveInviteCreatorId'
import { generateInviteToken } from '@/lib/subunternehmen/inviteToken'
import { ALL_SUBCONTRACTOR_PERMISSIONS } from '@/lib/subunternehmen/permissions'
import { logSubcontractorActivity } from '@/lib/subunternehmen/audit'
import { isFeatureEnabled } from '@/lib/featureFlags'
import { sendSubcontractorInviteEmailResult } from '@/lib/mailer'
import { logger } from '@/lib/logger'

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 Tage

const createSchema = z
  .object({
    subcontractorCompanyId: z.string().optional(),
    newCompany: z
      .object({
        name: z.string().min(1),
        employeeCount: z.number().int().min(1).default(1),
        email: z.string().email().optional().or(z.literal('')),
        phone: z.string().optional(),
        address: z.string().optional(),
      })
      .optional(),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    email: z.string().email(),
    phone: z.string().optional().or(z.literal('')),
    subcontractorRole: z.enum(['SUBCONTRACTOR_OWNER', 'SUBCONTRACTOR_USER']).default('SUBCONTRACTOR_OWNER'),
    permissions: z.array(z.string()).optional(),
    resend: z.boolean().optional().default(false),
  })
  .refine((data) => Boolean(data.subcontractorCompanyId) !== Boolean(data.newCompany), {
    message: 'Entweder ein bestehendes Subunternehmen auswählen oder ein neues anlegen',
  })

/** Erstellt eine Subunternehmen-Einladung (nur Admins). */
export async function POST(req: NextRequest) {
  try {
    const adminAuth = await requireAdminUser(req)
    if (!adminAuth.ok) {
      return NextResponse.json({ error: adminAuth.error }, { status: adminAuth.status })
    }
    if (!(await isFeatureEnabled('subcontractorInvitationsEnabled'))) {
      return NextResponse.json({ error: 'Subunternehmen-Einladungen sind deaktiviert' }, { status: 403 })
    }

    if (!hasValidCsrfIntent(req, 'invite:subcontractor-create')) {
      return NextResponse.json({ error: 'Ungültige Anforderung' }, { status: 400 })
    }

    await dbConnect()

    const parsed = createSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validierungsfehler', issues: parsed.error.flatten() },
        { status: 400 }
      )
    }
    const data = parsed.data
    const email = data.email.toLowerCase().trim()

    // Subunternehmen auflösen – bestehendes verwenden, KEINE Duplikate anlegen
    let company = null
    if (data.subcontractorCompanyId) {
      company = await Subcompany.findById(data.subcontractorCompanyId)
      if (!company) {
        return NextResponse.json({ error: 'Subunternehmen nicht gefunden' }, { status: 404 })
      }
    } else if (data.newCompany) {
      const existingByName = await Subcompany.findOne({ name: data.newCompany.name.trim() })
      if (existingByName) {
        // Kein doppelter Datensatz: bestehendes Unternehmen weiterverwenden
        company = existingByName
      } else {
        company = await Subcompany.create({
          name: data.newCompany.name.trim(),
          employeeCount: data.newCompany.employeeCount || 1,
          email: data.newCompany.email || '',
          phone: data.newCompany.phone || '',
          address: data.newCompany.address || '',
          status: 'active',
        })
      }
    }
    if (!company) {
      return NextResponse.json({ error: 'Subunternehmen konnte nicht ermittelt werden' }, { status: 400 })
    }
    if (company.status === 'blocked') {
      return NextResponse.json({ error: 'Dieses Subunternehmen ist gesperrt' }, { status: 409 })
    }

    // Bereits aktives Konto mit Membership?
    const existingUser = await User.findOne({ email })
    if (existingUser) {
      const existingMembership = await SubcontractorMembership.findOne({ userId: existingUser._id })
      if (existingMembership) {
        return NextResponse.json(
          { error: 'Dieser Benutzer ist bereits einem Subunternehmen zugeordnet' },
          { status: 409 }
        )
      }
      if (!['subunternehmen'].includes(existingUser.role)) {
        return NextResponse.json(
          { error: 'Ein interner Benutzer mit dieser E-Mail existiert bereits' },
          { status: 409 }
        )
      }
    }

    // Offene Einladung prüfen bzw. bei "erneut senden" ersetzen
    const pendingQuery = {
      email,
      invitationType: 'SUBCONTRACTOR',
      used: false,
      revokedAt: { $exists: false },
      expiresAt: { $gt: new Date() },
    }
    if (data.resend) {
      await InviteToken.updateMany(pendingQuery, { $set: { revokedAt: new Date() } })
    } else {
      const pending = await InviteToken.findOne(pendingQuery)
      if (pending) {
        return NextResponse.json(
          { error: 'Für diese E-Mail existiert bereits eine gültige Einladung' },
          { status: 409 }
        )
      }
    }

    const validPermissions = (data.permissions || []).filter((p) =>
      (ALL_SUBCONTRACTOR_PERMISSIONS as string[]).includes(p)
    )

    const { token, tokenHash } = generateInviteToken()
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS)
    const createdBy = await resolveInviteCreatorId(adminAuth.user.id)

    const invite = await InviteToken.create({
      email,
      role: 'subunternehmen',
      // Klartext-Token wird NICHT gespeichert – nur der Hash (in beiden Feldern,
      // damit der bestehende Unique-Index auf `token` greift).
      token: tokenHash,
      tokenHash,
      invitationType: 'SUBCONTRACTOR',
      subcontractorCompanyId: company._id,
      subcontractorRole: data.subcontractorRole,
      subcontractorPermissions: validPermissions,
      used: false,
      expiresAt,
      ...(createdBy ? { createdBy } : {}),
      name: `${data.firstName} ${data.lastName}`,
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
    })

    const baseUrl = getRequestBaseUrl(req);
    const inviteLink = `${baseUrl}/auth/set-password?token=${token}`
    const emailResult = await sendSubcontractorInviteEmailResult(
      email,
      `${data.firstName} ${data.lastName}`,
      String(company.name),
      inviteLink,
      expiresAt,
      adminAuth.user.name
    )

    await logSubcontractorActivity({
      actionType: data.resend ? 'subcontractor_invite_resent' : 'subcontractor_invite_created',
      description: `Subunternehmen-Einladung ${data.resend ? 'erneut ' : ''}versendet an ${email} (${company.name})`,
      userId: adminAuth.user.id,
      userName: adminAuth.user.name,
      userRole: adminAuth.user.role,
      entityId: invite._id,
      subcontractorCompanyId: company._id,
      meta: { subcontractorRole: data.subcontractorRole },
    })

    return NextResponse.json(
      {
        message: emailResult.ok
          ? 'Einladung erfolgreich versendet'
          : 'Einladung angelegt, E-Mail konnte nicht zugestellt werden.',
        emailSent: emailResult.ok,
        emailError: emailResult.error,
        // Fallback bei Mailversand-Fehler: Link zum manuellen Weitergeben an den
        // Admin zurückgeben (gleiche Vertraulichkeit wie die E-Mail selbst;
        // in der DB liegt weiterhin nur der Hash).
        ...(emailResult.ok ? {} : { inviteLink }),
        invite: {
          id: String(invite._id),
          email,
          companyId: String(company._id),
          companyName: company.name,
          subcontractorRole: data.subcontractorRole,
          expiresAt,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    logger.error('Subunternehmen-Einladung fehlgeschlagen', error)
    return NextResponse.json(
      { error: 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.' },
      { status: 500 }
    )
  }
}

/** Listet alle Subunternehmen-Einladungen inkl. Status (nur Admins). */
export async function GET(req: NextRequest) {
  try {
    const adminAuth = await requireAdminUser(req)
    if (!adminAuth.ok) {
      return NextResponse.json({ error: adminAuth.error }, { status: adminAuth.status })
    }
    await dbConnect()

    const invites = await InviteToken.find({ invitationType: 'SUBCONTRACTOR' })
      .sort({ createdAt: -1 })
      .limit(200)
      .lean()

    const companyIds = Array.from(
      new Set(invites.map((i: any) => String(i.subcontractorCompanyId || '')).filter(Boolean))
    )
    const companies = await Subcompany.find({ _id: { $in: companyIds } })
      .select('name')
      .lean()
    const companyNameById = new Map(companies.map((c: any) => [String(c._id), String(c.name)]))

    const now = Date.now()
    const items = invites.map((invite: any) => {
      let status: 'pending' | 'accepted' | 'expired' | 'cancelled' = 'pending'
      if (invite.used) status = 'accepted'
      else if (invite.revokedAt) status = 'cancelled'
      else if (new Date(invite.expiresAt).getTime() <= now) status = 'expired'
      return {
        id: String(invite._id),
        email: invite.email,
        name: invite.name,
        companyId: String(invite.subcontractorCompanyId || ''),
        companyName: companyNameById.get(String(invite.subcontractorCompanyId || '')) || '–',
        subcontractorRole: invite.subcontractorRole || 'SUBCONTRACTOR_OWNER',
        status,
        expiresAt: invite.expiresAt,
        acceptedAt: invite.acceptedAt,
        createdAt: invite.createdAt,
      }
    })

    return NextResponse.json({ invites: items })
  } catch (error) {
    logger.error('Subunternehmen-Einladungen konnten nicht geladen werden', error)
    return NextResponse.json({ error: 'Fehler beim Laden der Einladungen' }, { status: 500 })
  }
}
