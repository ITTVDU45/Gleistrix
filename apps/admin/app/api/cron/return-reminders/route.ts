import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { runReturnReminders } from '@/lib/lager/returnReminderService'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: NextRequest) {
  const expectedSecret = process.env.CRON_SECRET
  const authorization = request.headers.get('authorization')
  if (!expectedSecret || authorization !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ success: false, message: 'Nicht berechtigt' }, { status: 401 })
  }

  try {
    const result = await runReturnReminders()
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    logger.error('Automatische Rückgabe-Erinnerungen fehlgeschlagen', error)
    return NextResponse.json(
      { success: false, message: 'Rückgabe-Erinnerungen konnten nicht verarbeitet werden' },
      { status: 500 }
    )
  }
}
