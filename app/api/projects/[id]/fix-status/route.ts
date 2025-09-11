import { NextResponse } from 'next/server'
import dbConnect from '@/lib/dbConnect'
import { Project } from '@/lib/models/Project'
import { requireAuth } from '@/lib/security/requireAuth'

export async function GET(req: Request){
  try{
    await dbConnect()
    const auth = await requireAuth(req as any, ['user','admin','superadmin'])
    if (!auth.ok) return NextResponse.json({ message: auth.error }, { status: auth.status })

    // Hole die ID robust aus der URL, um Typisierungsprobleme des Kontext-Params zu vermeiden
    const url = new URL(req.url)
    const parts = url.pathname.split('/').filter(Boolean)
    const projectsIdx = parts.indexOf('projects')
    const id = projectsIdx >= 0 && parts.length > projectsIdx + 1 ? parts[projectsIdx + 1] : undefined
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
