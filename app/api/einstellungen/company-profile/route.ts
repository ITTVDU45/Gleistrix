import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import dbConnect from '@/lib/dbConnect'
import CompanyProfile from '@/lib/models/CompanyProfile'
import { requireAuth } from '@/lib/security/requireAuth'
import { requireAdminUser } from '@/lib/auth/requireAdminUser'
import { hasValidCsrfIntent } from '@/lib/security/requireCsrfIntent'
import { getCompanyProfile } from '@/lib/company/companyProfile'
import { logger } from '@/lib/logger'

const MAX_LOGO_BYTES = 500 * 1024 // 500 KB als Base64-Data-URI
const ALLOWED_LOGO_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp']

/** Aktuelles Firmenprofil lesen (alle angemeldeten internen Rollen). */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['user', 'admin', 'superadmin'])
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const profile = await getCompanyProfile()
    const logoDataUri =
      profile.logoBase64 && profile.logoContentType
        ? `data:${profile.logoContentType};base64,${profile.logoBase64}`
        : null

    return NextResponse.json({
      success: true,
      companyName: profile.companyName,
      logoDataUri,
    })
  } catch (error) {
    logger.error('Firmenprofil konnte nicht geladen werden', error)
    return NextResponse.json({ error: 'Fehler beim Laden des Firmenprofils' }, { status: 500 })
  }
}

const updateSchema = z.object({
  companyName: z.string().min(1).max(200).optional(),
  /** Data-URI (data:image/png;base64,....) oder null zum Entfernen */
  logoDataUri: z.string().max(Math.ceil(MAX_LOGO_BYTES * 1.4)).nullable().optional(),
})

/** Firmenprofil aktualisieren (nur Admins). */
export async function PUT(req: NextRequest) {
  try {
    const adminAuth = await requireAdminUser(req)
    if (!adminAuth.ok) return NextResponse.json({ error: adminAuth.error }, { status: adminAuth.status })
    if (!hasValidCsrfIntent(req, 'settings:company-profile')) {
      return NextResponse.json({ error: 'Ungültige Anforderung' }, { status: 400 })
    }

    await dbConnect()
    const parsed = updateSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validierungsfehler', issues: parsed.error.flatten() }, { status: 400 })
    }

    const update: Record<string, unknown> = {}
    if (parsed.data.companyName !== undefined) {
      update.companyName = parsed.data.companyName.trim()
    }

    if (parsed.data.logoDataUri === null) {
      // Logo entfernen
      update.logoBase64 = undefined
      update.logoContentType = undefined
    } else if (typeof parsed.data.logoDataUri === 'string') {
      const match = parsed.data.logoDataUri.match(/^data:([^;]+);base64,(.+)$/)
      if (!match) {
        return NextResponse.json({ error: 'Ungültiges Logo-Format' }, { status: 400 })
      }
      const [, contentType, base64] = match
      if (!ALLOWED_LOGO_TYPES.includes(contentType)) {
        return NextResponse.json(
          { error: 'Nur PNG, JPEG, SVG oder WebP sind als Logo erlaubt' },
          { status: 415 }
        )
      }
      // Base64 → Byte-Größe grob prüfen (3/4-Regel)
      const approxBytes = Math.floor((base64.length * 3) / 4)
      if (approxBytes > MAX_LOGO_BYTES) {
        return NextResponse.json(
          { error: `Logo zu groß (max. ${Math.round(MAX_LOGO_BYTES / 1024)} KB)` },
          { status: 413 }
        )
      }
      update.logoBase64 = base64
      update.logoContentType = contentType
    }

    const doc = await CompanyProfile.findOneAndUpdate(
      { scope: 'global' },
      { $set: update, $setOnInsert: { scope: 'global' } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean() as { companyName?: string; logoBase64?: string; logoContentType?: string } | null

    const logoDataUri =
      doc?.logoBase64 && doc?.logoContentType
        ? `data:${doc.logoContentType};base64,${doc.logoBase64}`
        : null

    return NextResponse.json({
      success: true,
      companyName: doc?.companyName || '',
      logoDataUri,
    })
  } catch (error) {
    logger.error('Firmenprofil konnte nicht gespeichert werden', error)
    return NextResponse.json({ error: 'Fehler beim Speichern des Firmenprofils' }, { status: 500 })
  }
}
