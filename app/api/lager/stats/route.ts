import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/dbConnect'
import { Article } from '@/lib/models/Article'
import { Maintenance } from '@/lib/models/Maintenance'
import { ArticleAssignment } from '@/lib/models/ArticleAssignment'
import { requireAuth } from '@/lib/security/requireAuth'
import mongoose from 'mongoose'

export async function GET(request: NextRequest) {
  try {
    await dbConnect()
    const auth = await requireAuth(request, ['user', 'admin', 'superadmin'])
    if (!auth.ok) {
      return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })
    }

    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    const [unterMindestbestand, faelligeWartungen, ueberfaelligeRueckgaben] = await Promise.all([
      Article.countDocuments({
        status: 'aktiv',
        $expr: { $and: [{ $gt: ['$mindestbestand', 0] }, { $lt: ['$bestand', '$mindestbestand'] }] }
      }),
      Maintenance.countDocuments({
        status: { $in: ['geplant', 'faellig'] },
        faelligkeitsdatum: { $lte: today }
      }),
      ArticleAssignment.countDocuments({
        status: 'ausgegeben',
        geplanteRueckgabe: { $lt: now, $ne: null }
      })
    ])

    return NextResponse.json({
      success: true,
      stats: {
        unterMindestbestand,
        faelligeWartungen,
        ueberfaelligeRueckgaben
      }
    })
  } catch (error) {
    console.error('Fehler beim Laden der LVS-Statistiken:', error)
    return NextResponse.json(
      { success: false, message: 'Fehler beim Laden der Statistiken' },
      { status: 500 }
    )
  }
}
