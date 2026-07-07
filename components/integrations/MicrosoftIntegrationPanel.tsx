'use client'

import { useState, useEffect, useCallback } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Cloud,
  CheckCircle2,
  KeyRound,
  Loader2,
  Save,
  Mail,
  Calendar,
  HardDrive,
  Building2,
  MessageSquare,
  AlertTriangle,
  Link,
  Unlink,
  User,
  RefreshCw,
} from 'lucide-react'

type MicrosoftModule = 'outlook' | 'calendar' | 'onedrive' | 'sharepoint' | 'teams'

interface ModuleOption {
  id: MicrosoftModule
  label: string
  description: string
  icon: typeof Mail
}

const MODULE_OPTIONS: ModuleOption[] = [
  { id: 'outlook', label: 'Outlook', description: 'E-Mail-Integration', icon: Mail },
  { id: 'calendar', label: 'Kalender', description: 'Termin-Synchronisation', icon: Calendar },
  { id: 'onedrive', label: 'OneDrive', description: 'Dokumentenablage', icon: HardDrive },
  { id: 'sharepoint', label: 'SharePoint', description: 'Projektordner', icon: Building2 },
  { id: 'teams', label: 'Teams', description: 'Benachrichtigungen', icon: MessageSquare },
]

interface MicrosoftConfig {
  clientId: string
  clientSecretConfigured: boolean
  redirectUri: string
  tenantMode: string
  enabledModules: MicrosoftModule[]
  storage: {
    provider: string
    baseFolderName: string
    projectFolderNameTemplate: string
  }
  outlook: {
    timeZone: string
    syncOnlyConfirmed: boolean
    subjectTemplate: string
  }
}

interface MicrosoftFormState {
  clientId: string
  clientSecret: string
  redirectUri: string
  tenantMode: string
  enabledModules: MicrosoftModule[]
  storageProvider: string
  baseFolderName: string
  projectFolderTemplate: string
  outlookTimeZone: string
  syncOnlyConfirmed: boolean
  subjectTemplate: string
}

const DEFAULT_FORM: MicrosoftFormState = {
  clientId: '',
  clientSecret: '',
  redirectUri: '',
  tenantMode: 'organizations',
  enabledModules: ['outlook', 'calendar'],
  storageProvider: 'onedrive',
  baseFolderName: 'Gleistrix ERP',
  projectFolderTemplate: '{{projektnummer}}_{{projektname}}',
  outlookTimeZone: 'Europe/Berlin',
  syncOnlyConfirmed: true,
  subjectTemplate: '{{projektName}} - {{rolle}}',
}

interface ConnectionInfo {
  status: string
  connectedUser?: { displayName?: string; email?: string } | null
  enabledModules?: string[]
  lastCheckedAt?: string | null
  lastError?: string | null
}

export default function MicrosoftIntegrationPanel() {
  const [form, setForm] = useState<MicrosoftFormState>(DEFAULT_FORM)
  const [status, setStatus] = useState<string>('disconnected')
  const [clientSecretConfigured, setClientSecretConfigured] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isDisconnecting, setIsDisconnecting] = useState(false)
  const [connectionInfo, setConnectionInfo] = useState<ConnectionInfo | null>(null)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [callbackUrl, setCallbackUrl] = useState('')

  // Empfohlene Redirect URI (Callback-Endpunkt) aus dem aktuellen Origin ableiten
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCallbackUrl(`${window.location.origin}/api/integrations/microsoft/callback`)
    }
  }, [])

  const loadConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/integrations/microsoft/config')
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.data) {
          const cfg = data.data as MicrosoftConfig
          setForm({
            clientId: cfg.clientId || '',
            clientSecret: '',
            redirectUri: cfg.redirectUri || '',
            tenantMode: cfg.tenantMode || 'organizations',
            enabledModules: cfg.enabledModules || ['outlook', 'calendar'],
            storageProvider: cfg.storage?.provider || 'onedrive',
            baseFolderName: cfg.storage?.baseFolderName || 'Gleistrix ERP',
            projectFolderTemplate: cfg.storage?.projectFolderNameTemplate || DEFAULT_FORM.projectFolderTemplate,
            outlookTimeZone: cfg.outlook?.timeZone || 'Europe/Berlin',
            syncOnlyConfirmed: cfg.outlook?.syncOnlyConfirmed !== false,
            subjectTemplate: cfg.outlook?.subjectTemplate || DEFAULT_FORM.subjectTemplate,
          })
          setClientSecretConfigured(cfg.clientSecretConfigured)
          setStatus(data.data.status || 'disconnected')
        }
      }
    } catch {
      // silently fail
    } finally {
      setIsLoading(false)
    }
  }, [])

  const checkConnectionStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/integrations/microsoft/status')
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.data) {
          setConnectionInfo(data.data)
          setStatus(data.data.status || 'disconnected')
        }
      }
    } catch {
      // silently fail
    }
  }, [])

  const handleConnect = async () => {
    setIsConnecting(true)
    setConnectionError(null)
    try {
      const res = await fetch('/api/integrations/microsoft/auth')
      const data = await res.json()
      if (data.success && data.data?.authUrl) {
        window.location.href = data.data.authUrl
      } else {
        setConnectionError(data.error || 'Verbindung konnte nicht gestartet werden')
      }
    } catch {
      setConnectionError('Netzwerkfehler beim Verbinden')
    } finally {
      setIsConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    setIsDisconnecting(true)
    try {
      const res = await fetch('/api/integrations/microsoft/disconnect', { method: 'POST' })
      if (res.ok) {
        setStatus('disconnected')
        setConnectionInfo(null)
      }
    } catch {
      // silently fail
    } finally {
      setIsDisconnecting(false)
    }
  }

  useEffect(() => { loadConfig() }, [loadConfig])

  useEffect(() => {
    if (!isLoading) {
      checkConnectionStatus()
    }
  }, [isLoading, checkConnectionStatus])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('success') === 'true') {
      checkConnectionStatus()
      window.history.replaceState({}, '', window.location.pathname)
    }
    const error = params.get('error')
    if (error) {
      setConnectionError(decodeURIComponent(error))
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [checkConnectionStatus])

  const handleSave = async () => {
    setIsSaving(true)
    setSaveSuccess(false)
    try {
      const res = await fetch('/api/integrations/microsoft/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        setSaveSuccess(true)
        setClientSecretConfigured(form.clientSecret ? true : clientSecretConfigured)
        setTimeout(() => setSaveSuccess(false), 3000)
      }
    } finally {
      setIsSaving(false)
    }
  }

  const toggleModule = (moduleId: MicrosoftModule) => {
    setForm((prev) => ({
      ...prev,
      enabledModules: prev.enabledModules.includes(moduleId)
        ? prev.enabledModules.filter((m) => m !== moduleId)
        : [...prev.enabledModules, moduleId],
    }))
  }

  const updateField = <K extends keyof MicrosoftFormState>(key: K, value: MicrosoftFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  if (isLoading) {
    return (
      <Card className="border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <CardContent className="flex items-center gap-2 p-6 text-sm text-slate-600 dark:text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Microsoft 365 wird geladen...
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-900/30">
            <Cloud className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Microsoft 365</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">Outlook, OneDrive, SharePoint & Teams</p>
          </div>
        </div>
        <Badge variant="outline" className={
          status === 'connected'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
            : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300'
        }>
          {status === 'connected' ? 'Verbunden' : 'Nicht verbunden'}
        </Badge>
      </div>

      {/* App-Registrierung */}
      <Card className="border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
            <KeyRound className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            Azure App-Registrierung
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Application (Client) ID</Label>
              <Input value={form.clientId} onChange={(e) => updateField('clientId', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>
                Client Secret {clientSecretConfigured && '(gespeichert)'}
              </Label>
              <Input
                type="password"
                value={form.clientSecret}
                placeholder={clientSecretConfigured ? 'Leer lassen, um Secret zu behalten' : ''}
                onChange={(e) => updateField('clientSecret', e.target.value)}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Redirect URI</Label>
              <Input
                value={form.redirectUri}
                onChange={(e) => updateField('redirectUri', e.target.value)}
                placeholder={callbackUrl}
              />
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Muss der Callback-Endpunkt sein (kein sichtbarer Seiten-Pfad) und exakt
                so auch in Azure unter „Authentifizierung → Web" hinterlegt sein:
              </p>
              {callbackUrl && (
                <div className="flex items-center gap-2">
                  <code className="flex-1 truncate rounded bg-slate-100 px-2 py-1 text-xs text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                    {callbackUrl}
                  </code>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => updateField('redirectUri', callbackUrl)}
                  >
                    Übernehmen
                  </Button>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>Tenant-Modus</Label>
              <Select value={form.tenantMode} onValueChange={(v) => updateField('tenantMode', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="organizations">Nur Organisationskonten</SelectItem>
                  <SelectItem value="common">Alle Microsoft-Konten</SelectItem>
                  <SelectItem value="consumers">Nur persönliche Konten</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Module */}
      <Card className="border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <CardHeader>
          <CardTitle className="text-slate-900 dark:text-white">Module aktivieren</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {MODULE_OPTIONS.map((mod) => {
              const Icon = mod.icon
              const isEnabled = form.enabledModules.includes(mod.id)
              return (
                <button
                  key={mod.id}
                  type="button"
                  onClick={() => toggleModule(mod.id)}
                  className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
                    isEnabled
                      ? 'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/20'
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                  }`}
                >
                  <div className={`p-2 rounded-lg ${isEnabled ? 'bg-blue-100 dark:bg-blue-900/40' : 'bg-slate-100 dark:bg-slate-700'}`}>
                    <Icon className={`h-4 w-4 ${isEnabled ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${isEnabled ? 'text-blue-900 dark:text-blue-200' : 'text-slate-900 dark:text-white'}`}>
                      {mod.label}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{mod.description}</p>
                  </div>
                  {isEnabled && <CheckCircle2 className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0" />}
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Verbindung */}
      <Card className="border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
            <Link className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            Microsoft 365 Verbindung
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === 'connected' && connectionInfo?.connectedUser ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-lg border border-emerald-200 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 p-4">
                <div className="p-2 rounded-full bg-emerald-100 dark:bg-emerald-900/40">
                  <User className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-emerald-900 dark:text-emerald-200">
                    {connectionInfo.connectedUser.displayName || 'Verbunden'}
                  </p>
                  <p className="text-xs text-emerald-700 dark:text-emerald-400 truncate">
                    {connectionInfo.connectedUser.email}
                  </p>
                </div>
                <Badge variant="outline" className="border-emerald-300 text-emerald-700 dark:border-emerald-600 dark:text-emerald-300 shrink-0">
                  Verbunden
                </Badge>
              </div>
              {connectionInfo.lastCheckedAt && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Zuletzt geprüft: {new Date(connectionInfo.lastCheckedAt).toLocaleString('de-DE')}
                </p>
              )}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => checkConnectionStatus()}>
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Status prüfen
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDisconnect}
                  disabled={isDisconnecting}
                  className="text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-700 dark:hover:bg-red-900/20"
                >
                  {isDisconnecting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Unlink className="h-4 w-4 mr-1" />}
                  Trennen
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {status === 'error' && (
                <div className="flex items-start gap-3 rounded-lg border border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/20 p-3">
                  <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
                  <p className="text-sm text-red-700 dark:text-red-400">
                    {connectionInfo?.lastError || 'Verbindung fehlerhaft — bitte erneut verbinden'}
                  </p>
                </div>
              )}
              {connectionError && (
                <div className="flex items-start gap-3 rounded-lg border border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/20 p-3">
                  <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
                  <p className="text-sm text-red-700 dark:text-red-400">{connectionError}</p>
                </div>
              )}
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Verbinden Sie Ihr Microsoft 365-Konto, um Outlook, Kalender, OneDrive, SharePoint und Teams zu nutzen.
              </p>
              <Button
                onClick={handleConnect}
                disabled={isConnecting || !form.clientId}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isConnecting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Cloud className="h-4 w-4 mr-2" />}
                Mit Microsoft 365 verbinden
              </Button>
              {!form.clientId && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Bitte zuerst die Azure App-Registrierung konfigurieren und speichern.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dokumentenablage */}
      {(form.enabledModules.includes('onedrive') || form.enabledModules.includes('sharepoint')) && (
        <Card className="border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
              <HardDrive className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              Dokumentenablage
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Speicher-Anbieter</Label>
                <Select value={form.storageProvider} onValueChange={(v) => updateField('storageProvider', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="onedrive">OneDrive</SelectItem>
                    <SelectItem value="sharepoint">SharePoint</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Basis-Ordnername</Label>
                <Input value={form.baseFolderName} onChange={(e) => updateField('baseFolderName', e.target.value)} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Projektordner-Template</Label>
                <Input
                  value={form.projectFolderTemplate}
                  onChange={(e) => updateField('projectFolderTemplate', e.target.value)}
                  placeholder="{{projektnummer}}_{{projektname}}"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Verfügbare Variablen: {'{{projektnummer}}'}, {'{{projektname}}'}, {'{{auftraggeber}}'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Outlook/Kalender */}
      {(form.enabledModules.includes('outlook') || form.enabledModules.includes('calendar')) && (
        <Card className="border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
              <Mail className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              Outlook & Kalender
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Zeitzone</Label>
                <Select value={form.outlookTimeZone} onValueChange={(v) => updateField('outlookTimeZone', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Europe/Berlin">Europe/Berlin</SelectItem>
                    <SelectItem value="Europe/Vienna">Europe/Vienna</SelectItem>
                    <SelectItem value="Europe/Zurich">Europe/Zurich</SelectItem>
                    <SelectItem value="UTC">UTC</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Betreff-Template</Label>
                <Input
                  value={form.subjectTemplate}
                  onChange={(e) => updateField('subjectTemplate', e.target.value)}
                  placeholder="{{projektName}} - {{rolle}}"
                />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 p-3">
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-white">Nur bestätigte Einsätze synchronisieren</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Unbestätigte Einsätze werden nicht in den Kalender übertragen</p>
              </div>
              <Switch checked={form.syncOnlyConfirmed} onCheckedChange={(v) => updateField('syncOnlyConfirmed', v)} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Hinweis */}
      {!form.clientId && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-4">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-900 dark:text-amber-200">Konfiguration unvollständig</p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
              Registrieren Sie eine App im Azure Portal und tragen Sie die Application ID und das Client Secret ein.
            </p>
          </div>
        </div>
      )}

      {/* Speichern */}
      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={isSaving} className="bg-blue-600 hover:bg-blue-700 text-white">
          {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Einstellungen speichern
        </Button>
        {saveSuccess && (
          <span className="flex items-center gap-1 text-sm text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />
            Gespeichert
          </span>
        )}
      </div>
    </div>
  )
}
