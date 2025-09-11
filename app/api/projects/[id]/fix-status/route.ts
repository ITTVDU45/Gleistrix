import { NextResponse } from 'next/server'
import dbConnect from '@/lib/dbConnect'
import { Project } from '@/lib/models/Project'
import { requireAuth } from '@/lib/security/requireAuth'

export async function GET(req: Request, context: any){
  try{
    await dbConnect()
    const auth = await requireAuth(req as any, ['user','admin','superadmin'])
    if (!auth.ok) return NextResponse.json({ message: auth.error }, { status: auth.status })

    const { id } = (context?.params || {}) as { id?: string }
    if (!id) return NextResponse.json({ message: 'Projekt-ID fehlt' }, { status: 400 })

    const project = await Project.findById(id).lean()
    if (!project) return NextResponse.json({ message: 'Projekt nicht gefunden' }, { status: 404 })

    // Setze Status direkt auf "geleistet"
    await Project.findByIdAndUpdate(id, { $set: { status: 'geleistet' } })

    return NextResponse.json({ 
      success: true, 
      oldStatus: (project as any).status,
      newStatus: 'geleistet'
    })
  } catch(e){
    console.error('Status-Update fehlgeschlagen', e)
    return NextResponse.json({ message: 'Fehler beim Aktualisieren des Status' }, { status: 500 })
  }
}
