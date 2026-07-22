'use client'

import { useEffect, useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { ArrowLeft, CalendarPlus, FolderPlus, FolderSearch, Sparkles } from 'lucide-react'
import ProjectCreateWithGaeb from '@/components/ProjectCreateWithGaeb'
import { formatProjectBarTitle } from '@/lib/plantafel/projectLabel'
import SearchableSelect from '../SearchableSelect'
import ChoiceCard from './ChoiceCard'
import type { Project } from '../../../types'

/** Zieltab des Editors, der nach Abschluss des Assistenten geöffnet wird. */
export type WizardTarget = 'einsatz' | 'zeiten'

type WizardStep = 'mode' | 'einsatz-project' | 'projekt-mode' | 'projekt-new' | 'projekt-existing'

/** Zurück-Ziel je Schritt; 'mode' ist der Einstieg und hat keins. */
const PREVIOUS_STEP: Record<WizardStep, WizardStep | null> = {
  mode: null,
  'einsatz-project': 'mode',
  'projekt-mode': 'mode',
  'projekt-new': 'projekt-mode',
  'projekt-existing': 'projekt-mode',
}

const STEP_TITLES: Record<WizardStep, string> = {
  mode: 'Was möchten Sie anlegen?',
  'einsatz-project': 'Bestehendes Projekt auswählen',
  'projekt-mode': 'Neues oder bestehendes Projekt?',
  'projekt-new': 'Neues Projekt erstellen',
  'projekt-existing': 'Bestehendes Projekt auswählen',
}

interface CreateEntryWizardProps {
  open: boolean
  projects: Project[]
  /** Vorbelegung für Datumsfelder eines neu angelegten Projekts (yyyy-MM-dd). */
  dateKey: string
  onClose: () => void
  /** Nach dem Anlegen eines Projekts — Projektliste der Tafel neu laden. */
  onProjectCreated: () => void
  /** Assistent abgeschlossen: Editor für dieses Projekt im passenden Tab öffnen. */
  onComplete: (result: { projectId: string; target: WizardTarget }) => void
}

/**
 * Mehrstufiger Assistent hinter "Neuer Einsatz" in der Einsatztafel.
 *
 * Einsatz  → bestehendes Projekt wählen → Einsatz-Tab des Editors
 * Projekt  → neu anlegen (manuell/GAEB/Leistungsanfrage) oder bestehendes
 *            wählen → Zeiten-Tab des Editors
 *
 * Der Assistent legt selbst nichts an außer dem Projekt; die eigentlichen
 * Formulare sind die bereits bestehenden Editor-Tabs.
 */
export default function CreateEntryWizard({
  open,
  projects,
  dateKey,
  onClose,
  onProjectCreated,
  onComplete,
}: CreateEntryWizardProps) {
  const [step, setStep] = useState<WizardStep>('mode')

  useEffect(() => {
    if (open) setStep('mode')
  }, [open])

  // Bewusst alle Projekte (nicht nur aktive) — die Suche im Dropdown filtert.
  const projectOptions = useMemo(
    () =>
      [...projects]
        .sort((a, b) => a.name.localeCompare(b.name, 'de-DE'))
        .map((p) => ({ value: p.id, label: formatProjectBarTitle(p.name, p.auftragsnummer) })),
    [projects]
  )

  const previous = PREVIOUS_STEP[step]

  const handleProjectCreated = (createdProjectId?: string) => {
    onProjectCreated()
    if (createdProjectId) onComplete({ projectId: createdProjectId, target: 'zeiten' })
    else onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogTitle className="flex items-center gap-2 pr-6">
          {previous && (
            <Button
              variant="ghost"
              size="sm"
              className="-ml-2 shrink-0"
              onClick={() => setStep(previous)}
              aria-label="Zurück"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <span className="truncate">{STEP_TITLES[step]}</span>
        </DialogTitle>

        {step === 'mode' && (
          <div className="grid gap-3 sm:grid-cols-2 py-2">
            <ChoiceCard
              icon={CalendarPlus}
              title="Einsatz erstellen"
              description="Einsatz für ein bestehendes Projekt planen — Mitarbeiter, Zeiten und Rolle."
              onClick={() => setStep('einsatz-project')}
            />
            <ChoiceCard
              icon={FolderPlus}
              title="Projekt erstellen"
              description="Neues Projekt anlegen oder Zeiten zu einem bestehenden Projekt erfassen."
              onClick={() => setStep('projekt-mode')}
            />
          </div>
        )}

        {step === 'einsatz-project' && (
          <div className="space-y-3 py-2">
            <Label>Projekt auswählen *</Label>
            <SearchableSelect
              value=""
              onValueChange={(projectId) => onComplete({ projectId, target: 'einsatz' })}
              options={projectOptions}
              placeholder="Projekt auswählen"
              emptyLabel="Kein Projekt gefunden"
              searchPlaceholder="Projekt suchen..."
            />
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Nach der Auswahl können Sie den Einsatz mit Mitarbeitern und Zeiten anlegen.
            </p>
          </div>
        )}

        {step === 'projekt-mode' && (
          <div className="grid gap-3 sm:grid-cols-2 py-2">
            <ChoiceCard
              icon={Sparkles}
              title="Neues Projekt anlegen"
              description="Manuell, aus einem GAEB-LV oder per KI aus einer Leistungsanfrage."
              onClick={() => setStep('projekt-new')}
            />
            <ChoiceCard
              icon={FolderSearch}
              title="Bestehendes Projekt auswählen"
              description="Projekt suchen und Mitarbeiter mit Zeiten dazu erfassen."
              onClick={() => setStep('projekt-existing')}
            />
          </div>
        )}

        {step === 'projekt-new' && (
          <ProjectCreateWithGaeb
            onSuccess={handleProjectCreated}
            onCancel={() => setStep('projekt-mode')}
            initialValues={{ datumBeginn: dateKey, datumEnde: dateKey }}
          />
        )}

        {step === 'projekt-existing' && (
          <div className="space-y-3 py-2">
            <Label>Projekt auswählen *</Label>
            <SearchableSelect
              value=""
              onValueChange={(projectId) => onComplete({ projectId, target: 'zeiten' })}
              options={projectOptions}
              placeholder="Projekt auswählen"
              emptyLabel="Kein Projekt gefunden"
              searchPlaceholder="Projekt suchen..."
            />
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Nach der Auswahl können Sie Mitarbeiter mit Zeiten, Material und Fahrzeuge erfassen.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
