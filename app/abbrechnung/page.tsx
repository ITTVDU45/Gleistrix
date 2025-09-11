import AbrechnungClient from './AbrechnungClient'
import dbConnect from '@/lib/dbConnect'
import { Project as ProjectModel } from '@/lib/models/Project'

async function getProjectsData() {
  try {
    await dbConnect()
    const projects = await ProjectModel.find({}).lean()
    return projects.map((p: any) => ({
      id: (p._id || p.id)?.toString(),
      name: p.name,
      auftragsnummer: p.auftragsnummer,
      auftraggeber: p.auftraggeber || p.client || null,
      baustelle: p.baustelle || p.location || null,
      status: p.status,
      mitarbeiterZeiten: p.mitarbeiterZeiten || {},
      // include dokumente if available for later use
      dokumente: p.dokumente || null,
      datumBeginn: p.datumBeginn instanceof Date ? p.datumBeginn.toISOString() : p.datumBeginn,
      datumEnde: p.datumEnde instanceof Date ? p.datumEnde.toISOString() : p.datumEnde,
    }))
  } catch (e) {
    console.error('Failed to load projects for abrechnung', e)
    return []
  }
}

export default async function Page(){
  const projects = await getProjectsData()
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Abrechnung</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">Projekte zur Abrechnung verwalten</p>
        </div>
      </div>
      <AbrechnungClient projects={projects} />
    </div>
  )
}


