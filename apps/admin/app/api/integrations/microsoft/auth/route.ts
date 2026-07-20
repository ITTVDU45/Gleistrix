import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/dbConnect'
import { requireAuth } from '@/lib/security/requireAuth'
import IntegrationConfig from '@/lib/models/IntegrationConfig'
import { buildAuthorizationUrl } from '@/lib/services/microsoft/oauth'
import crypto from 'crypto'

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  }

  if (auth.token?.role !== 'admin' && auth.token?.role !== 'superadmin') {
    return NextResponse.json({ success: false, error: 'Nur Administratoren' }, { status: 403 })
  }

  await dbConnect()

  const doc = await IntegrationConfig.findOne({ integrationId: 'microsoft' }).lean() as Record<string, unknown> | null
  const config = (doc?.config as Record<string, unknown>) || {}

  if (!config.clientId || !config.clientSecret || !config.redirectUri) {
    return NextResponse.json(
      { success: false, error: 'Microsoft-Konfiguration unvollständig. Bitte zuerst Client ID, Secret und Redirect URI eintragen.' },
      { status: 400 }
    )
  }

  const state = crypto.randomBytes(32).toString('hex')

  await IntegrationConfig.findOneAndUpdate(
    { integrationId: 'microsoft' },
    { $set: { 'config.oauthState': state } }
  )

  const authUrl = buildAuthorizationUrl(
    {
      clientId: config.clientId as string,
      clientSecret: config.clientSecret as string,
      redirectUri: config.redirectUri as string,
      tenantMode: (config.tenantMode as string) || 'organizations',
    },
    (config.enabledModules as string[]) || ['outlook', 'calendar'],
    state
  )

  return NextResponse.json({ success: true, data: { authUrl } })
}
