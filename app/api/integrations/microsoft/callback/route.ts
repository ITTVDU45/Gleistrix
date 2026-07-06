import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/dbConnect'
import IntegrationConfig from '@/lib/models/IntegrationConfig'
import { exchangeCodeForTokens, validateToken } from '@/lib/services/microsoft/oauth'

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  const state = req.nextUrl.searchParams.get('state')
  const error = req.nextUrl.searchParams.get('error')
  const errorDescription = req.nextUrl.searchParams.get('error_description')

  const settingsUrl = '/einstellungen?tab=integrations&integration=microsoft'

  if (error) {
    const msg = encodeURIComponent(errorDescription || error)
    return NextResponse.redirect(new URL(`${settingsUrl}&error=${msg}`, req.url))
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL(`${settingsUrl}&error=Fehlende+Parameter`, req.url))
  }

  await dbConnect()

  const doc = await IntegrationConfig.findOne({ integrationId: 'microsoft' }).lean() as Record<string, unknown> | null
  const config = (doc?.config as Record<string, unknown>) || {}

  if (config.oauthState !== state) {
    return NextResponse.redirect(new URL(`${settingsUrl}&error=Ungültiger+State-Parameter`, req.url))
  }

  try {
    const tokens = await exchangeCodeForTokens(
      {
        clientId: config.clientId as string,
        clientSecret: config.clientSecret as string,
        redirectUri: config.redirectUri as string,
        tenantMode: (config.tenantMode as string) || 'organizations',
      },
      code,
      (config.enabledModules as string[]) || ['outlook', 'calendar']
    )

    const profile = await validateToken(tokens.accessToken)
    if (!profile.valid) {
      return NextResponse.redirect(new URL(`${settingsUrl}&error=Token-Validierung+fehlgeschlagen`, req.url))
    }

    await IntegrationConfig.findOneAndUpdate(
      { integrationId: 'microsoft' },
      {
        $set: {
          status: 'connected',
          'config.tokens': tokens,
          'config.oauthState': null,
          'config.connectedUser': {
            displayName: profile.displayName,
            email: profile.email,
          },
          lastCheckedAt: new Date(),
          lastError: null,
        },
      }
    )

    return NextResponse.redirect(new URL(`${settingsUrl}&success=true`, req.url))
  } catch (err) {
    const msg = encodeURIComponent(err instanceof Error ? err.message : 'Unbekannter Fehler')
    return NextResponse.redirect(new URL(`${settingsUrl}&error=${msg}`, req.url))
  }
}
