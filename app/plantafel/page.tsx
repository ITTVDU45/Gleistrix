'use client'

import '@/styles/plantafel.css'
import PlantafelBoard from '@/components/plantafel/PlantafelBoard'

export default function PlantafelPage() {
  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 overflow-hidden">
      <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
        Plantafel
      </h1>
      <PlantafelBoard />
    </div>
  )
}
