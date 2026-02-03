import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/dbConnect'
import { ArticleAssignment } from '@/lib/models/ArticleAssignment'
import { Article } from '@/lib/models/Article'
import { StockMovement } from '@/lib/models/StockMovement'
import { getCurrentUser } from '@/lib/auth/getCurrentUser'
import { requireAuth } from '@/lib/security/requireAuth'
import mongoose from 'mongoose'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect()
    const { id } = await params
    const csrf = request.headers.get('x-csrf-intent')
    if (process.env.NODE_ENV === 'production' && csrf !== 'lager:assignments:return') {
      return NextResponse.json({ success: false, message: 'Ungültige Anforderung' }, { status: 400 })
    }
    const auth = await requireAuth(request, ['user', 'admin', 'superadmin'])
    if (!auth.ok) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status })

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, message: 'Ungültige Zuweisungs-ID' }, { status: 400 })
    }

    const assignment = await ArticleAssignment.findById(id)
    if (!assignment) {
      return NextResponse.json({ success: false, message: 'Zuweisung nicht gefunden' }, { status: 404 })
    }
    if (assignment.status === 'zurueckgegeben') {
      return NextResponse.json({ success: false, message: 'Bereits zurückgegeben' }, { status: 400 })
    }

    const currentUser = await getCurrentUser(request)
    const rueckgabedatum = new Date()

    await ArticleAssignment.findByIdAndUpdate(id, {
      rueckgabedatum,
      status: 'zurueckgegeben'
    })

    await Article.findByIdAndUpdate(assignment.artikelId, {
      $inc: { bestand: assignment.menge }
    })

    await StockMovement.create({
      artikelId: assignment.artikelId,
      bewegungstyp: 'eingang',
      menge: assignment.menge,
      datum: rueckgabedatum,
      verantwortlich: currentUser?._id,
      empfaenger: assignment.personId,
      bemerkung: 'Rücknahme von Ausgabe'
    })

    if (currentUser) {
      try {
        const ActivityLogModel = (await import('@/lib/models/ActivityLog')).default
        await ActivityLogModel.create({
          timestamp: new Date(),
          actionType: 'lager_assignment_returned',
          module: 'lager',
          performedBy: {
            userId: currentUser._id,
            name: currentUser.name ?? '',
            role: currentUser.role ?? 'user'
          },
          details: {
            entityId: assignment._id,
            description: 'Rücknahme erfasst',
            after: { status: 'zurueckgegeben' }
          }
        })
      } catch (logErr) {
        console.error('ActivityLog Fehler:', logErr)
      }
    }

    const updated = await ArticleAssignment.findById(id)
      .populate('artikelId', 'bezeichnung artikelnummer')
      .populate('personId', 'name')
      .lean()
    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('Fehler bei Rücknahme:', error)
    return NextResponse.json(
      { success: false, message: 'Fehler bei Rücknahme' },
      { status: 500 }
    )
  }
}
