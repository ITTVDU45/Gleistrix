'use client'

import { useCallback, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Checkbox } from '@/components/ui/checkbox'
import { FileCode2, Save, Loader2, CheckCircle2, AlertTriangle, Info } from 'lucide-react'
import { GaebApi } from '@/lib/api/gaeb'
import { GAEB_VERSIONS, DEFAULT_GAEB_SETTINGS } from '@/lib/gaeb/registry'
import type { GaebIntegrationSettings } from '@/types/gaeb'
import GaebUploadDropzone from '@/components/gaeb/GaebUploadDropzone'
import GaebImportHistory from '@/components/gaeb/GaebImportHistory'

/** Alle über die Registry bekannten Phasen (dedupliziert, mit Label). */
const ALL_PHASES = Array.from(
  new Map(GAEB_VERSIONS.flatMap((v) => v.phases).map((p) => [p.code, p])).values()
)

export default function GaebIntegrationPanel() {
  const [settings, setSettings] = useState<GaebIntegrationSettings>(DEFAULT_GAEB_SETTINGS)
  const [status, setStatus] = useState<string>('disconnected')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [importRefresh, setImportRefresh] = useState(0)
  const [xsdAvailable, setXsdAvailable] = useState(false)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError('')
    try {
      const res = await GaebApi.config.get()
      setSettings(res.data.settings)
      setStatus(res.data.status)
      setXsdAvailable(Boolean(res.data.xsdEngineAvailable))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Konfiguration konnte nicht geladen werden')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const update = <K extends keyof GaebIntegrationSettings>(key: K, value: GaebIntegrationSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  const toggleInArray = (key: 'allowedVersions' | 'allowedPhases', value: string) => {
    setSettings((prev) => {
      const list = prev[key]
      const next = list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
      return { ...prev, [key]: next }
    })
    setSaved(false)
  }

  const handleSave = async () => {
    setIsSaving(true)
    setError('')
    try {
      const res = await GaebApi.config.save(settings)
      setSettings(res.data.settings)
      setStatus(res.data.status)
      setSaved(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Speichern fehlgeschlagen')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Kopf */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-slate-100 p-3 dark:bg-slate-700">
            <FileCode2 className="h-6 w-6 text-slate-700 dark:text-slate-200" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">GAEB-Integration</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Import & Validierung von GAEB-DA-XML-Dateien (LV, Ausschreibung, Angebot, Rechnung).
            </p>
          </div>
        </div>
        <Badge
          variant="outline"
          className={
            settings.enabled
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
              : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300'
          }
        >
          {settings.enabled ? 'Aktiv' : 'Deaktiviert'}
        </Badge>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {/* Aktivierung */}
      <Card className="rounded-2xl border-slate-200 dark:border-slate-700">
        <CardContent className="flex items-center justify-between gap-4 p-5">
          <div>
            <p className="font-medium text-slate-900 dark:text-white">Integration aktivieren</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Schaltet GAEB-Funktionen (Upload, Validierung, Import) frei. Konfiguration gilt global für das Unternehmen.
            </p>
          </div>
          <Switch checked={settings.enabled} onCheckedChange={(v) => update('enabled', v)} />
        </CardContent>
      </Card>

      {/* Versionen */}
      <Card className="rounded-2xl border-slate-200 dark:border-slate-700">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Unterstützte GAEB-Versionen</CardTitle>
        </CardHeader>
        <CardContent className="p-5 pt-0">
          <div className="grid gap-2 sm:grid-cols-2">
            {GAEB_VERSIONS.map((v) => (
              <label
                key={v.id}
                className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700"
              >
                <Checkbox
                  checked={settings.allowedVersions.includes(v.id)}
                  onCheckedChange={() => toggleInArray('allowedVersions', v.id)}
                />
                <span className="text-sm text-slate-700 dark:text-slate-200">{v.label}</span>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Phasen */}
      <Card className="rounded-2xl border-slate-200 dark:border-slate-700">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Unterstützte Austauschphasen</CardTitle>
        </CardHeader>
        <CardContent className="p-5 pt-0">
          <div className="grid gap-2 sm:grid-cols-2">
            {ALL_PHASES.map((p) => (
              <label
                key={p.code}
                className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700"
              >
                <Checkbox
                  checked={settings.allowedPhases.includes(p.code)}
                  onCheckedChange={() => toggleInArray('allowedPhases', p.code)}
                />
                <span className="text-sm text-slate-700 dark:text-slate-200">
                  <span className="font-mono text-xs text-slate-500">{p.code}</span> · {p.label}
                </span>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Optionen */}
      <Card className="rounded-2xl border-slate-200 dark:border-slate-700">
        <CardContent className="space-y-4 p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium text-slate-900 dark:text-white">Strikte XSD-Validierung</p>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    xsdAvailable
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                      : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                  }`}
                >
                  {xsdAvailable ? 'XSD-Engine aktiv' : 'Fallback (strukturell)'}
                </span>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Importe werden gegen offizielle GAEB-XSD-Schemata geprüft.
                {!xsdAvailable && ' XSD-Schemata unter lib/gaeb/xsd/ ablegen, um die Prüfung zu aktivieren.'}
              </p>
            </div>
            <Switch
              checked={settings.strictXsdValidation}
              onCheckedChange={(v) => update('strictXsdValidation', v)}
            />
          </div>
          <Separator />
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Maximale Dateigröße (MB)</Label>
              <Input
                type="number"
                min={1}
                value={Math.round(settings.maxFileSizeBytes / (1024 * 1024))}
                onChange={(e) =>
                  update('maxFileSizeBytes', Math.max(1, Number(e.target.value) || 1) * 1024 * 1024)
                }
                className="rounded-lg"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Upload-Testbereich + Import-Historie */}
      <Card className="rounded-2xl border-slate-200 dark:border-slate-700">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Upload-Testbereich</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-5 pt-0">
          <GaebUploadDropzone
            disabled={!settings.enabled}
            onUploaded={() => setImportRefresh((k) => k + 1)}
          />
          {!settings.enabled && (
            <p className="text-xs text-slate-400">
              Aktivieren und speichern, um GAEB-Dateien hochladen zu können.
            </p>
          )}
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-200">Import-Historie</p>
            <GaebImportHistory refreshKey={importRefresh} />
          </div>
        </CardContent>
      </Card>

      {/* Hinweis auf Folge-Phasen */}
      <div className="flex items-start gap-2 rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        Uploads werden aktuell gespeichert und in der Historie geführt. XSD-Validierung, Parsing der
        LV-Struktur und Vorschau folgen in den nächsten Ausbaustufen.
      </div>

      {/* Speichern */}
      <div className="flex items-center justify-end gap-3">
        {saved && (
          <span className="flex items-center gap-1 text-sm text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4" /> Gespeichert
          </span>
        )}
        <Button onClick={handleSave} disabled={isSaving} className="gap-1">
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Speichern
        </Button>
      </div>
    </div>
  )
}
