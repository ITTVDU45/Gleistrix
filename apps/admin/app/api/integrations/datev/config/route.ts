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

  const doc = await IntegrationConfig.findOne({ integrationId: 'datev' }).lean()
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

  const existing = await IntegrationConfig.findOne({ integrationId: 'datev' }).lean() as Record<string, unknown> | null
  const existingConfig = (existing?.config as Record<string, unknown>) || {}

  const updatedConfig: Record<string, unknown> = {
    clientId: body.clientId || '',
    redirectUri: body.redirectUri || '',
    mode: body.mode || 'sandbox',
    dryRun: body.dryRun !== false,
    consultantNumber: body.consultantNumber || '',
    clientNumber: body.clientNumber || '',
    revenueAccountDefault: body.revenueAccountDefault || '8400',
    taxAccount19: body.taxAccount19 || '1776',
    taxAccount7: body.taxAccount7 || '1771',
    debtorAccountPrefix: body.debtorAccountPrefix || '10',
    creditorAccountPrefix: body.creditorAccountPrefix || '70',
    costCenterMode: body.costCenterMode || 'project',
    autoUploadDocuments: Boolean(body.autoUploadDocuments),
  }

  if (body.clientSecret) {
    updatedConfig.clientSecret = body.clientSecret
  } else if (existingConfig.clientSecret) {
    updatedConfig.clientSecret = existingConfig.clientSecret
  }

  await IntegrationConfig.findOneAndUpdate(
    { integrationId: 'datev' },
    {
      integrationId: 'datev',
      config: updatedConfig,
      connectedByUserId: auth.token?.id || null,
    },
    { upsert: true, new: true }
  )

  return NextResponse.json({ success: true, data: null })
}
