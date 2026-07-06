'use client'

import '@/styles/plantafel.css'
import PlantafelBoard from '@/components/plantafel/PlantafelBoard'

export default function PlantafelPage() {
  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Plantafel
        </h1>
      </div>
      <PlantafelBoard />
    </div>
  )
}
