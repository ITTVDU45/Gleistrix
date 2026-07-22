import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { requireAuth } from '@/lib/security/requireAuth'
import { hasValidCsrfIntent } from '@/lib/security/requireCsrfIntent'
import type { IntentKey } from '@/lib/http/fetchWithIntent'

export async function requireFinanceAccess(request: NextRequest) {
  const auth = await requireAuth(request, ['superadmin'])
  if (!auth.ok) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  return null
}

export async function requireFinanceMutation(request: NextRequest, intent: IntentKey) {
  const access = await requireFinanceAccess(request)
  if (access) return access
  if (!hasValidCsrfIntent(request, intent)) {
    return NextResponse.json({ success: false, error: 'Ungültige Anforderung' }, { status: 400 })
  }
  return null
}

export function validObjectId(id: string) {
  return mongoose.Types.ObjectId.isValid(id)
}

export function optionalObjectId(value: unknown) {
  return typeof value === 'string' && value ? value : undefined
}

export function financeApiError(error: unknown, fallback: string) {
  if ((error as { code?: number }).code === 11000) {
    return NextResponse.json({ success: false, error: 'Dieser Datensatz existiert bereits.' }, { status: 409 })
  }
  return NextResponse.json({ success: false, error: fallback }, { status: 500 })
}
