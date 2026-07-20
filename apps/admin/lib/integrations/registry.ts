import {
  Calculator,
  Cloud,
  FileCode2,
  type LucideIcon,
} from 'lucide-react'

export type IntegrationId = 'datev' | 'microsoft' | 'gaeb'

export type IntegrationStatus = 'active' | 'configured' | 'available' | 'planned'

export type IntegrationCategory = 'Finanzen' | 'Produktivitaet' | 'Ausschreibung'

export interface IntegrationModule {
  id: IntegrationId
  title: string
  description: string
  category: IntegrationCategory
  status: IntegrationStatus
  icon: LucideIcon
  features: string[]
}

export const integrationModules: IntegrationModule[] = [
  {
    id: 'datev',
    title: 'DATEV',
    description: 'Beleg- und Buchungsdatenexport für Steuerberatung. Sandbox- und Produktionsmodus.',
    category: 'Finanzen',
    status: 'available',
    icon: Calculator,
    features: [
      'Buchungsdatenexport',
      'Belegübertragung',
      'Sandbox / Produktion',
      'Dry-Run Modus',
      'Kontenzuordnung',
    ],
  },
  {
    id: 'microsoft',
    title: 'Microsoft 365',
    description: 'Outlook, Teams, OneDrive und SharePoint für Projekte und Kommunikation.',
    category: 'Produktivitaet',
    status: 'available',
    icon: Cloud,
    features: [
      'Outlook E-Mail & Kalender',
      'OneDrive Dokumentenablage',
      'SharePoint Projektordner',
      'Teams Benachrichtigungen',
    ],
  },
  {
    id: 'gaeb',
    title: 'GAEB',
    description: 'Import, Validierung und Auswertung von GAEB-DA-XML-Dateien (LV, Ausschreibung, Angebot, Rechnung).',
    category: 'Ausschreibung',
    status: 'available',
    icon: FileCode2,
    features: [
      'GAEB DA XML Import',
      'XML/XSD-Validierung',
      'LV-Positionen erkennen',
      'Versionen & Phasen konfigurierbar',
      'Import-Historie',
    ],
  },
]

export function getIntegrationModule(id: string): IntegrationModule | undefined {
  return integrationModules.find((m) => m.id === id)
}

export function integrationStatusLabel(status: IntegrationStatus): string {
  switch (status) {
    case 'active': return 'Aktiv'
    case 'configured': return 'Konfiguriert'
    case 'available': return 'Verfügbar'
    case 'planned': return 'Geplant'
  }
}

export function integrationStatusColor(status: IntegrationStatus): string {
  switch (status) {
    case 'active': return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
    case 'configured': return 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
    case 'available': return 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300'
    case 'planned': return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
  }
}
