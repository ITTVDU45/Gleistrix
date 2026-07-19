"use client";
import React, { useEffect, useState } from 'react'
import { logger } from '@/lib/logger'
import { getErrorMessage } from '@/lib/errors'
import { getJSON, putJSON } from '@/lib/http/apiClient'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ToggleRight } from 'lucide-react'

type Flags = Record<string, boolean>

const FLAG_META: Record<string, { label: string; description: string }> = {
  subcontractorPortalEnabled: {
    label: 'Subunternehmen-Portal',
    description: 'Zugang zum Portal für eingeladene Subunternehmen (Projekte, Einsätze, Rechnungen).',
  },
  receivedInvoicesEnabled: {
    label: 'Erhaltene Rechnungen',
    description: 'Interner Prüfbereich unter Abrechnung → Erhaltene Rechnungen.',
  },
  subcontractorInvitationsEnabled: {
    label: 'Subunternehmen-Einladungen',
    description: 'Versand neuer Portal-Einladungen an Subunternehmen.',
  },
}

/** Mandantenweite Feature-Flags für das Subunternehmen-Portal. */
export default function FeatureFlagsAdmin() {
  const [flags, setFlags] = useState<Flags | null>(null)
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getJSON<{ flags: Flags }>('/api/einstellungen/feature-flags')
        setFlags(data.flags)
      } catch (err) {
        logger.error('Feature-Flags konnten nicht geladen werden', err)
        setError(getErrorMessage(err))
      }
    }
    load()
  }, [])

  const toggle = async (key: string, value: boolean) => {
    if (!flags) return
    const previous = flags
    setFlags({ ...flags, [key]: value })
    setIsSaving(true)
    setError('')
    try {
      const data = await putJSON<{ flags: Flags }>(
        '/api/einstellungen/feature-flags',
        { [key]: value },
        'settings:feature-flags'
      )
      setFlags(data.flags)
    } catch (err) {
      setFlags(previous)
      setError(getErrorMessage(err))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card className="border-0 shadow-lg bg-white dark:bg-slate-800 rounded-xl">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
            <ToggleRight className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Subunternehmen-Portal</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">Feature-Flags für diesen Mandanten</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && (
          <Alert variant="destructive" className="rounded-lg">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {!flags ? (
          <div className="flex justify-center py-6">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
          </div>
        ) : (
          Object.entries(FLAG_META).map(([key, meta]) => (
            <div
              key={key}
              className="flex items-center justify-between rounded-xl border border-slate-100 dark:border-slate-700 px-4 py-3"
            >
              <div className="min-w-0 pr-4">
                <p className="text-sm font-medium text-slate-900 dark:text-white">{meta.label}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{meta.description}</p>
              </div>
              <Switch
                checked={Boolean(flags[key])}
                disabled={isSaving}
                onCheckedChange={(checked) => toggle(key, checked)}
              />
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
