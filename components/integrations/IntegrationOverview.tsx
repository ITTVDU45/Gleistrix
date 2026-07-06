'use client'

import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowRight, CheckCircle2 } from 'lucide-react'
import {
  integrationModules,
  integrationStatusLabel,
  integrationStatusColor,
  type IntegrationId,
} from '@/lib/integrations/registry'
import DatevIntegrationPanel from './DatevIntegrationPanel'
import MicrosoftIntegrationPanel from './MicrosoftIntegrationPanel'

export default function IntegrationOverview() {
  const [selectedId, setSelectedId] = useState<IntegrationId | null>(null)

  useEffect(() => {
    const integration = new URLSearchParams(window.location.search).get('integration')
    if (integration === 'microsoft' || integration === 'datev') {
      setSelectedId(integration)
    }
  }, [])

  if (selectedId === 'datev') {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => setSelectedId(null)}>
          ← Zurück zur Übersicht
        </Button>
        <DatevIntegrationPanel />
      </div>
    )
  }

  if (selectedId === 'microsoft') {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => setSelectedId(null)}>
          ← Zurück zur Übersicht
        </Button>
        <MicrosoftIntegrationPanel />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Integrationen</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          Verbinden Sie externe Dienste mit Ihrer Gleistrix-Instanz.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {integrationModules.map((integration) => {
          const Icon = integration.icon
          return (
            <Card
              key={integration.id}
              className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => setSelectedId(integration.id)}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-700">
                      <Icon className="h-6 w-6 text-slate-700 dark:text-slate-300" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900 dark:text-white">
                        {integration.title}
                      </h3>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {integration.category}
                      </span>
                    </div>
                  </div>
                  <Badge variant="outline" className={integrationStatusColor(integration.status)}>
                    {integrationStatusLabel(integration.status)}
                  </Badge>
                </div>

                <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                  {integration.description}
                </p>

                <div className="space-y-1.5 mb-4">
                  {integration.features.map((feature) => (
                    <div key={feature} className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      {feature}
                    </div>
                  ))}
                </div>

                <div className="flex justify-end">
                  <Button variant="outline" size="sm">
                    Konfigurieren
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
