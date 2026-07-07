import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/dbConnect'
import { requireAuth } from '@/lib/security/requireAuth'
import IntegrationConfig from '@/lib/models/IntegrationConfig'

/**
 * Leichter Status: Ist die OneDrive-Spiegelung aktiv (verbunden + Modul
 * 'onedrive')? Ohne Graph-Aufruf, ohne Secrets – für Nicht-Admins nutzbar
 * (z.B. Hinweis in der Projekt-Dokumentenkarte).
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  }

  await dbConnect()
  const doc = (await IntegrationConfig.findOne({ integrationId: 'microsoft' }).lean()) as Record<string, unknown> | null
  const config = (doc?.config as Record<string, unknown>) || {}
  const modules = (config.enabledModules as string[]) || []
  const onedriveActive = doc?.status === 'connected' && modules.includes('onedrive')

  return NextResponse.json({ success: true, data: { onedriveActive } })
}
