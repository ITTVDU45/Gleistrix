'use client'

import { useState } from 'react'
import { FileCode2 } from 'lucide-react'
import { Button } from './ui/button'
import ProjectCreateForm from './ProjectCreateForm'
import GaebImportPanel from './gaeb/GaebImportPanel'
import { useGaebAccess } from './gaeb/useGaebAccess'
import type { Project } from '../types'

type ProjectPrefill = Partial<Omit<Project, 'id' | 'mitarbeiterZeiten'>>

interface ProjectCreateWithGaebProps {
  onSuccess: () => void
  onCancel: () => void
  initialValues?: ProjectPrefill
}

/**
 * Drop-in für ProjectCreateForm mit optionaler GAEB-Vorbefüllung (admin-only).
 * Ein importiertes GAEB-LV befüllt den Projektnamen vor; die vollständige
 * Projektzuordnung des LVs erfolgt anschließend über das Projektdokumente-Popup.
 */
export default function ProjectCreateWithGaeb({ onSuccess, onCancel, initialValues }: ProjectCreateWithGaebProps) {
  const { isGaebAdmin } = useGaebAccess()
  const [showGaeb, setShowGaeb] = useState(false)
  const [prefill, setPrefill] = useState<ProjectPrefill>({})
  const [formKey, setFormKey] = useState(0)

  const handleImported = ({ boq }: { boq: { projectName?: string } | null }) => {
    if (boq?.projectName) {
      setPrefill({ name: boq.projectName })
      setFormKey((k) => k + 1) // Remount, damit initialValues greifen
      setShowGaeb(false)
    }
  }

  return (
    <div className="space-y-4">
      {isGaebAdmin && (
        <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-slate-800 dark:text-slate-100">Aus GAEB-LV vorbefüllen</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Optional: LV importieren, um den Projektnamen zu übernehmen.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowGaeb((s) => !s)}>
              <FileCode2 className="mr-1 h-4 w-4" /> {showGaeb ? 'Ausblenden' : 'GAEB-LV importieren'}
            </Button>
          </div>
          {showGaeb && (
            <div className="mt-3">
              <GaebImportPanel onImported={handleImported} />
            </div>
          )}
          {prefill.name && (
            <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">
              Projektname „{prefill.name}" aus GAEB übernommen – bitte prüfen und restliche Felder ergänzen.
            </p>
          )}
        </div>
      )}

      <ProjectCreateForm
        key={formKey}
        onSuccess={onSuccess}
        onCancel={onCancel}
        initialValues={{ ...initialValues, ...prefill }}
      />
    </div>
  )
}
