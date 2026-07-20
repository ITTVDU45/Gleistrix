'use client'

import { useState, useEffect, useCallback } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import {
  Calculator,
  CheckCircle2,
  KeyRound,
  Loader2,
  Save,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react'

interface DatevConfig {
  clientId: string
  clientSecretConfigured: boolean
  redirectUri: string
  mode: 'sandbox' | 'production'
  dryRun: boolean
  consultantNumber: string
  clientNumber: string
  revenueAccountDefault: string
  taxAccount19: string
  taxAccount7: string
  debtorAccountPrefix: string
  creditorAccountPrefix: string
  costCenterMode: string
  autoUploadDocuments: boolean
}

interface DatevFormState {
  clientId: string
  clientSecret: string
  redirectUri: string
  mode: string
  dryRun: boolean
  consultantNumber: string
  clientNumber: string
  revenueAccountDefault: string
  taxAccount19: string
  taxAccount7: string
  debtorAccountPrefix: string
  creditorAccountPrefix: string
  costCenterMode: string
  autoUploadDocuments: boolean
}

const DEFAULT_FORM: DatevFormState = {
  clientId: '',
  clientSecret: '',
  redirectUri: '',
  mode: 'sandbox',
  dryRun: true,
  consultantNumber: '',
  clientNumber: '',
  revenueAccountDefault: '8400',
  taxAccount19: '1776',
  taxAccount7: '1771',
  debtorAccountPrefix: '10',
  creditorAccountPrefix: '70',
  costCenterMode: 'project',
  autoUploadDocuments: false,
}

export default function DatevIntegrationPanel() {
  const [form, setForm] = useState<DatevFormState>(DEFAULT_FORM)
  const [status, setStatus] = useState<'disconnected' | 'connected' | 'error'>('disconnected')
  const [clientSecretConfigured, setClientSecretConfigured] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  const loadConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/integrations/datev/config')
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.data) {
          const cfg = data.data as DatevConfig
          setForm({
            clientId: cfg.clientId || '',
            clientSecret: '',
            redirectUri: cfg.redirectUri || '',
            mode: cfg.mode || 'sandbox',
            dryRun: cfg.dryRun !== false,
            consultantNumber: cfg.consultantNumber || '',
            clientNumber: cfg.clientNumber || '',
            revenueAccountDefault: cfg.revenueAccountDefault || '8400',
            taxAccount19: cfg.taxAccount19 || '1776',
            taxAccount7: cfg.taxAccount7 || '1771',
            debtorAccountPrefix: cfg.debtorAccountPrefix || '10',
            creditorAccountPrefix: cfg.creditorAccountPrefix || '70',
            costCenterMode: cfg.costCenterMode || 'project',
            autoUploadDocuments: Boolean(cfg.autoUploadDocuments),
          })
          setClientSecretConfigured(cfg.clientSecretConfigured)
          setStatus(data.data.status || 'disconnected')
        }
      }
    } catch {
      // silently fail on first load
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { loadConfig() }, [loadConfig])

  const handleSave = async () => {
    setIsSaving(true)
    setSaveSuccess(false)
    try {
      const res = await fetch('/api/integrations/datev/config', {
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

  const updateField = <K extends keyof DatevFormState>(key: K, value: DatevFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  if (isLoading) {
    return (
      <Card className="border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <CardContent className="flex items-center gap-2 p-6 text-sm text-slate-600 dark:text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          DATEV wird geladen...
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
            <Calculator className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">DATEV Integration</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">Steuerberater-Schnittstelle konfigurieren</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={
            status === 'connected'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
              : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300'
          }>
            {status === 'connected' ? 'Verbunden' : 'Nicht verbunden'}
          </Badge>
          {form.dryRun && (
            <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
              Dry-Run
            </Badge>
          )}
        </div>
      </div>

      {/* App-Zugang */}
      <Card className="border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
            <KeyRound className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            App-Zugang
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Client ID</Label>
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
              <Input value={form.redirectUri} onChange={(e) => updateField('redirectUri', e.target.value)} />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Modus</Label>
              <Select value={form.mode} onValueChange={(v) => updateField('mode', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sandbox">Sandbox</SelectItem>
                  <SelectItem value="production">Produktion</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 p-3">
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-white">Dry-Run</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Keine produktiven Schreiboperationen</p>
              </div>
              <Switch checked={form.dryRun} onCheckedChange={(v) => updateField('dryRun', v)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Verbindung */}
      <Card className="border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
            <ShieldCheck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            Mandant
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Beraternummer</Label>
              <Input value={form.consultantNumber} onChange={(e) => updateField('consultantNumber', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Mandantennummer</Label>
              <Input value={form.clientNumber} onChange={(e) => updateField('clientNumber', e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Export-Einstellungen */}
      <Card className="border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <CardHeader>
          <CardTitle className="text-slate-900 dark:text-white">Export-Einstellungen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Standard-Erlöskonto</Label>
              <Input value={form.revenueAccountDefault} onChange={(e) => updateField('revenueAccountDefault', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Steuerkonto 19%</Label>
              <Input value={form.taxAccount19} onChange={(e) => updateField('taxAccount19', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Steuerkonto 7%</Label>
              <Input value={form.taxAccount7} onChange={(e) => updateField('taxAccount7', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Debitoren-Prefix</Label>
              <Input value={form.debtorAccountPrefix} onChange={(e) => updateField('debtorAccountPrefix', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Kreditoren-Prefix</Label>
              <Input value={form.creditorAccountPrefix} onChange={(e) => updateField('creditorAccountPrefix', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Kostenstellenmodus</Label>
              <Select value={form.costCenterMode} onValueChange={(v) => updateField('costCenterMode', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="project">Projekt</SelectItem>
                  <SelectItem value="department">Abteilung</SelectItem>
                  <SelectItem value="none">Keine</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 p-3">
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-white">Belege automatisch vorbereiten</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Belege werden als Dry-Run vorbereitet und geloggt</p>
            </div>
            <Switch checked={form.autoUploadDocuments} onCheckedChange={(v) => updateField('autoUploadDocuments', v)} />
          </div>
        </CardContent>
      </Card>

      {/* Hinweis */}
      {!form.clientId && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-4">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-900 dark:text-amber-200">Konfiguration unvollständig</p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
              DATEV Client ID und Redirect URI sind noch nicht hinterlegt. Dry-Run-Exports bleiben nutzbar.
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
