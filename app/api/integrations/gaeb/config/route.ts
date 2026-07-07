import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import dbConnect from '@/lib/dbConnect'
import { requireAuth } from '@/lib/security/requireAuth'
import IntegrationConfig from '@/lib/models/IntegrationConfig'
import { mergeGaebSettings } from '@/lib/gaeb/registry'
import type { GaebIntegrationSettings } from '@/types/gaeb'

const INTEGRATION_ID = 'gaeb'

const settingsSchema = z.object({
  enabled: z.boolean(),
  scope: z.enum(['global', 'mandant']),
  mandantId: z.string().optional(),
  allowedVersions: z.array(z.string()).max(20),
  allowedPhases: z.array(z.string()).max(30),
  maxFileSizeBytes: z.number().int().positive().max(500 * 1024 * 1024),
  strictXsdValidation: z.boolean(),
})

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, ['admin', 'superadmin'])
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  }

  await dbConnect()

  const doc = (await IntegrationConfig.findOne({ integrationId: INTEGRATION_ID }).lean()) as
    | Record<string, unknown>
    | null

  const settings = mergeGaebSettings((doc?.config as Partial<GaebIntegrationSettings>) ?? null)
  const status = (doc?.status as string) ?? 'disconnected'

  return NextResponse.json({ success: true, data: { settings, status } })
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, ['admin', 'superadmin'])
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  }

  await dbConnect()

  const parsed = settingsSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'Validierungsfehler', issues: parsed.error.flatten() },
      { status: 400 }
    )
  }

  // Gegen Registry normalisieren (unbekannte Versionen/Phasen filtern)
  const settings = mergeGaebSettings(parsed.data)
  const status = settings.enabled ? 'connected' : 'disconnected'

  await IntegrationConfig.findOneAndUpdate(
    { integrationId: INTEGRATION_ID },
    {
      integrationId: INTEGRATION_ID,
      config: settings,
      status,
      lastCheckedAt: new Date(),
      lastError: null,
      connectedByUserId: (auth.token as { sub?: string })?.sub ?? null,
    },
    { upsert: true, new: true }
  )

  return NextResponse.json({ success: true, data: { settings, status } })
}
