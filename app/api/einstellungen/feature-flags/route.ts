import { NextRequest, NextResponse } from 'next/server'
import { hasValidCsrfIntent } from '@/lib/security/requireCsrfIntent'
import { z } from 'zod'
import { requireAdminUser } from '@/lib/auth/requireAdminUser'
import { getFeatureFlags, setFeatureFlags, DEFAULT_FEATURE_FLAGS } from '@/lib/featureFlags'
import { logger } from '@/lib/logger'

/** Aktuelle Feature-Flags lesen (nur Admins). */
export async function GET(req: NextRequest) {
  try {
    const adminAuth = await requireAdminUser(req)
    if (!adminAuth.ok) return NextResponse.json({ error: adminAuth.error }, { status: adminAuth.status })
    const flags = await getFeatureFlags()
    return NextResponse.json({ success: true, flags })
  } catch (error) {
    logger.error('Feature-Flags konnten nicht geladen werden', error)
    return NextResponse.json({ error: 'Fehler beim Laden der Feature-Flags' }, { status: 500 })
  }
}

const updateSchema = z.object(
  Object.fromEntries(
    Object.keys(DEFAULT_FEATURE_FLAGS).map((key) => [key, z.boolean().optional()])
  ) as Record<string, z.ZodOptional<z.ZodBoolean>>
)

/** Feature-Flags setzen (nur Admins). */
export async function PUT(req: NextRequest) {
  try {
    const adminAuth = await requireAdminUser(req)
    if (!adminAuth.ok) return NextResponse.json({ error: adminAuth.error }, { status: adminAuth.status })
    if (!hasValidCsrfIntent(req, 'settings:feature-flags')) {
      return NextResponse.json({ error: 'Ungültige Anforderung' }, { status: 400 })
    }

    const parsed = updateSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validierungsfehler' }, { status: 400 })
    }

    const flags = await setFeatureFlags(parsed.data)
    return NextResponse.json({ success: true, flags })
  } catch (error) {
    logger.error('Feature-Flags konnten nicht gespeichert werden', error)
    return NextResponse.json({ error: 'Fehler beim Speichern der Feature-Flags' }, { status: 500 })
  }
}
