import { Suspense } from 'react'
import MitarbeiterPageClient from './MitarbeiterPageClient'

export default function MitarbeiterPage() {
  return (
    <Suspense fallback={<div className="p-6 text-slate-500">Lade...</div>}>
      <MitarbeiterPageClient />
    </Suspense>
  )
}
