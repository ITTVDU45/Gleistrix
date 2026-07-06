import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/dbConnect'
import { requireAuth } from '@/lib/security/requireAuth'
import IntegrationConfig from '@/lib/models/IntegrationConfig'

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  }

  if (auth.token?.role !== 'admin' && auth.token?.role !== 'superadmin') {
    return NextResponse.json({ success: false, error: 'Nur Administratoren' }, { status: 403 })
  }

  await dbConnect()

  await IntegrationConfig.findOneAndUpdate(
    { integrationId: 'microsoft' },
    {
      $set: {
        status: 'disconnected',
        lastError: null,
        lastCheckedAt: new Date(),
      },
      $unset: {
        'config.tokens': 1,
        'config.connectedUser': 1,
        'config.oauthState': 1,
      },
    }
  )

  return NextResponse.json({ success: true })
}
