import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/dbConnect'
import { requireAuth } from '@/lib/security/requireAuth'
import IntegrationConfig from '@/lib/models/IntegrationConfig'
import { validateToken, refreshAccessToken } from '@/lib/services/microsoft/oauth'

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  }

  await dbConnect()

  const doc = await IntegrationConfig.findOne({ integrationId: 'microsoft' }).lean() as Record<string, unknown> | null
  if (!doc) {
    return NextResponse.json({
      success: true,
      data: { status: 'disconnected', configured: false },
    })
  }

  const config = (doc.config as Record<string, unknown>) || {}
  const tokens = config.tokens as { accessToken: string; refreshToken: string; expiresAt: number } | undefined
  const status = doc.status as string

  if (status !== 'connected' || !tokens) {
    return NextResponse.json({
      success: true,
      data: {
        status: status || 'disconnected',
        configured: Boolean(config.clientId),
        lastError: doc.lastError || null,
      },
    })
  }

  let profile = await validateToken(tokens.accessToken)

  if (!profile.valid && tokens.refreshToken) {
    try {
      const refreshed = await refreshAccessToken(
        {
          clientId: config.clientId as string,
          clientSecret: config.clientSecret as string,
          redirectUri: config.redirectUri as string,
          tenantMode: (config.tenantMode as string) || 'organizations',
        },
        tokens.refreshToken
      )

      await IntegrationConfig.findOneAndUpdate(
        { integrationId: 'microsoft' },
        {
          $set: {
            'config.tokens': refreshed,
            lastCheckedAt: new Date(),
            lastError: null,
          },
        }
      )

      profile = await validateToken(refreshed.accessToken)
    } catch (err) {
      await IntegrationConfig.findOneAndUpdate(
        { integrationId: 'microsoft' },
        {
          $set: {
            status: 'error',
            lastError: err instanceof Error ? err.message : 'Token refresh fehlgeschlagen',
            lastCheckedAt: new Date(),
          },
        }
      )

      return NextResponse.json({
        success: true,
        data: {
          status: 'error',
          configured: true,
          lastError: 'Token konnte nicht erneuert werden — bitte erneut verbinden',
        },
      })
    }
  }

  if (!profile.valid) {
    await IntegrationConfig.findOneAndUpdate(
      { integrationId: 'microsoft' },
      {
        $set: {
          status: 'error',
          lastError: 'Token ungültig',
          lastCheckedAt: new Date(),
        },
      }
    )
  }

  const connectedUser = config.connectedUser as { displayName?: string; email?: string } | undefined

  return NextResponse.json({
    success: true,
    data: {
      status: profile.valid ? 'connected' : 'error',
      configured: true,
      connectedUser: profile.valid
        ? { displayName: profile.displayName, email: profile.email }
        : connectedUser || null,
      enabledModules: config.enabledModules || [],
      lastCheckedAt: doc.lastCheckedAt || null,
    },
  })
}
