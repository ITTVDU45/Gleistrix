import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/dbConnect'
import { requireAuth } from '@/lib/security/requireAuth'
import IntegrationConfig from '@/lib/models/IntegrationConfig'

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  }

  await dbConnect()

  const doc = await IntegrationConfig.findOne({ integrationId: 'microsoft' }).lean()
  if (!doc) {
    return NextResponse.json({ success: true, data: null })
  }

  const config = (doc as Record<string, unknown>).config as Record<string, unknown> || {}
  return NextResponse.json({
    success: true,
    data: {
      ...config,
      clientSecretConfigured: Boolean(config.clientSecret),
      clientSecret: undefined,
      status: (doc as Record<string, unknown>).status || 'disconnected',
    },
  })
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  }

  if (auth.token?.role !== 'admin' && auth.token?.role !== 'superadmin') {
    return NextResponse.json({ success: false, error: 'Nur Administratoren können Integrationen konfigurieren' }, { status: 403 })
  }

  await dbConnect()

  const body = await req.json()

  const existing = await IntegrationConfig.findOne({ integrationId: 'microsoft' }).lean() as Record<string, unknown> | null
  const existingConfig = (existing?.config as Record<string, unknown>) || {}

  // Whitespace/Zeilenumbrüche aus Copy-Paste entfernen – sonst wird die
  // Authorize-URL ungültig (Microsoft antwortet mit `invalid_request`).
  const trimStr = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

  const updatedConfig: Record<string, unknown> = {
    clientId: trimStr(body.clientId),
    redirectUri: trimStr(body.redirectUri),
    tenantMode: body.tenantMode || 'organizations',
    enabledModules: body.enabledModules || ['outlook', 'calendar'],
    storage: {
      provider: body.storageProvider || 'onedrive',
      baseFolderName: body.baseFolderName || 'Gleistrix ERP',
      projectFolderNameTemplate: body.projectFolderTemplate || '{{projektnummer}}_{{projektname}}',
    },
    outlook: {
      timeZone: body.outlookTimeZone || 'Europe/Berlin',
      syncOnlyConfirmed: body.syncOnlyConfirmed !== false,
      subjectTemplate: body.subjectTemplate || '{{projektName}} - {{rolle}}',
    },
  }

  if (body.clientSecret) {
    updatedConfig.clientSecret = trimStr(body.clientSecret)
  } else if (existingConfig.clientSecret) {
    updatedConfig.clientSecret = existingConfig.clientSecret
  }

  // Verbindungs-/Laufzeitdaten beim Speichern der Einstellungen NICHT verwerfen
  // (sonst geht die bestehende Microsoft-365-Verbindung verloren).
  if (existingConfig.tokens) updatedConfig.tokens = existingConfig.tokens
  if (existingConfig.connectedUser) updatedConfig.connectedUser = existingConfig.connectedUser
  if (existingConfig.oauthState) updatedConfig.oauthState = existingConfig.oauthState
  if (existingConfig.webhook) updatedConfig.webhook = existingConfig.webhook

  await IntegrationConfig.findOneAndUpdate(
    { integrationId: 'microsoft' },
    {
      integrationId: 'microsoft',
      config: updatedConfig,
      connectedByUserId: auth.token?.id || null,
    },
    { upsert: true, new: true }
  )

  return NextResponse.json({ success: true, data: null })
}
