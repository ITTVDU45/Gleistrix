import { NextResponse } from 'next/server'
import dbConnect from '@/lib/dbConnect'
import { Project } from '@/lib/models/Project'
import { requireAuth } from '@/lib/security/requireAuth'

export async function POST(req: Request, context: any){
  try{
    await dbConnect()
    const auth = await requireAuth(req as any, ['user','admin','superadmin'])
    if (!auth.ok) return NextResponse.json({ message: auth.error }, { status: auth.status })

    const { id } = (context?.params || {}) as { id?: string }
    if (!id) return NextResponse.json({ message: 'Projekt-ID fehlt' }, { status: 400 })

    const project = await Project.findById(id).lean()
    if (!project) return NextResponse.json({ message: 'Projekt nicht gefunden' }, { status: 404 })

    // Alle Tage mit Einträgen UND die Folgetage bei tagübergreifenden Einträgen
    const allDaysSet = new Set<string>()
    
    // Zuerst Tage mit Einträgen sammeln
    Object.entries((project as any).mitarbeiterZeiten || {}).forEach(([day, arr]: any) => {
      if (Array.isArray(arr) && arr.length > 0) {
        allDaysSet.add(day)
        
        // Dann Folgetage für tagübergreifende Einträge
        for (const e of arr) {
          const endStr = e?.ende || e?.end
          if (typeof endStr === 'string' && endStr.includes('T')) {
            const endDay = endStr.slice(0,10)
            if (endDay && endDay !== day) {
              allDaysSet.add(endDay)
            }
          }
        }
      }
    })
    
    const allDays = Array.from(allDaysSet)
    const abgerechneteTage: string[] = Array.isArray((project as any).abgerechneteTage) ? (project as any).abgerechneteTage : []
    
    console.log('Projektstatus-Berechnung:', {
      projektId: project._id,
      allDays,
      abgerechneteTage,
      allDaysLength: allDays.length,
      abgerechneteTageLength: abgerechneteTage.length,
      isComplete: allDays.length > 0 && abgerechneteTage.length >= allDays.length
    })
    
    let newStatus = (project as any).status
    if (abgerechneteTage.length > 0 && allDays.length > 0 && abgerechneteTage.length < allDays.length) {
      newStatus = 'teilweise_abgerechnet'
    }
    if (allDays.length > 0 && abgerechneteTage.length >= allDays.length) {
      newStatus = 'geleistet'
    }
    
    console.log('Setze neuen Status:', newStatus)
    await Project.findByIdAndUpdate(id, { $set: { status: newStatus } })

    return NextResponse.json({ 
      success: true, 
      oldStatus: (project as any).status,
      newStatus,
      allDays,
      abgerechneteTage
    })
  } catch(e){
    console.error('Status-Update fehlgeschlagen', e)
    return NextResponse.json({ message: 'Fehler beim Aktualisieren des Status' }, { status: 500 })
  }
}
