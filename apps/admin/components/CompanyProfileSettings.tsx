'use client'
import React, { useEffect, useRef, useState } from 'react'
import { logger } from '@/lib/logger'
import { getErrorMessage } from '@/lib/errors'
import { getJSON, putJSON } from '@/lib/http/apiClient'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Building2, ImageOff, Upload } from 'lucide-react'

interface CompanyProfileResponse {
  companyName: string
  logoDataUri: string | null
  error?: string
}

const MAX_LOGO_KB = 500

type Props = {
  /** Nur Admins/Superadmins dürfen bearbeiten; sonst nur Ansicht */
  canManage: boolean
}

/**
 * Firmenprofil (Name + Logo) für E-Mails und Dokumente. Das Logo wird als
 * Base64 gespeichert – dadurch in E-Mails zuverlässig einbettbar (auch
 * serverless), ohne Filesystem-Abhängigkeit.
 */
export default function CompanyProfileSettings({ canManage }: Props) {
  const [companyName, setCompanyName] = useState('')
  const [logoDataUri, setLogoDataUri] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getJSON<CompanyProfileResponse>('/api/einstellungen/company-profile')
        setCompanyName(data.companyName || '')
        setLogoDataUri(data.logoDataUri)
      } catch (err) {
        logger.error('Firmenprofil konnte nicht geladen werden', err)
        setError(getErrorMessage(err))
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [])

  const handleFile = (file: File) => {
    setError('')
    setSuccess('')
    if (!['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'].includes(file.type)) {
      setError('Nur PNG, JPEG, SVG oder WebP sind erlaubt.')
      return
    }
    if (file.size > MAX_LOGO_KB * 1024) {
      setError(`Logo zu groß (max. ${MAX_LOGO_KB} KB).`)
      return
    }
    const reader = new FileReader()
    reader.onload = () => setLogoDataUri(typeof reader.result === 'string' ? reader.result : null)
    reader.onerror = () => setError('Datei konnte nicht gelesen werden.')
    reader.readAsDataURL(file)
  }

  const handleSave = async () => {
    setError('')
    setSuccess('')
    if (!companyName.trim()) {
      setError('Bitte einen Firmennamen angeben.')
      return
    }
    setIsSaving(true)
    try {
      const data = await putJSON<CompanyProfileResponse>(
        '/api/einstellungen/company-profile',
        { companyName: companyName.trim(), logoDataUri },
        'settings:company-profile'
      )
      setCompanyName(data.companyName || '')
      setLogoDataUri(data.logoDataUri)
      setSuccess('Firmenprofil gespeichert. Neue E-Mails nutzen ab sofort diese Angaben.')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setIsSaving(false)
    }
  }

  const removeLogo = () => {
    setLogoDataUri(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <Card className="border-0 shadow-lg bg-white dark:bg-slate-800 rounded-xl">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
            <Building2 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Firmenprofil</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Firmenname und Logo für E-Mails (z. B. Subunternehmen-Einladungen)
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 md:p-6 space-y-5">
        {isLoading ? (
          <div className="flex justify-center py-6">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Firmenname</Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  disabled={!canManage}
                  placeholder="z. B. Mülheimer Wachdienst GmbH"
                  className="pl-10 rounded-xl h-12 dark:bg-slate-700 dark:text-white"
                />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Erscheint in der E-Mail-Signatur unter dem Namen der einladenden Person.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Firmenlogo</Label>
              <div className="flex items-center gap-4">
                <div className="w-40 h-20 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 flex items-center justify-center overflow-hidden">
                  {logoDataUri ? (
                    <img src={logoDataUri} alt="Firmenlogo" className="max-h-16 max-w-[150px] object-contain" />
                  ) : (
                    <div className="flex flex-col items-center text-slate-400">
                      <ImageOff className="h-6 w-6" />
                      <span className="text-[11px] mt-1">Kein Logo</span>
                    </div>
                  )}
                </div>
                {canManage && (
                  <div className="space-y-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/svg+xml,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) handleFile(file)
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      className="rounded-xl"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Logo auswählen
                    </Button>
                    {logoDataUri && (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={removeLogo}
                        className="rounded-xl text-red-600 block"
                      >
                        Logo entfernen
                      </Button>
                    )}
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      PNG, JPEG, SVG oder WebP · max. {MAX_LOGO_KB} KB
                    </p>
                  </div>
                )}
              </div>
            </div>

            {error && (
              <Alert variant="destructive" className="rounded-lg">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {success && (
              <Alert className="rounded-lg bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800">
                <AlertDescription className="text-green-800 dark:text-green-300">{success}</AlertDescription>
              </Alert>
            )}

            {canManage ? (
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-12 px-6 shadow-lg hover:shadow-xl"
              >
                {isSaving ? 'Speichern...' : 'Firmenprofil speichern'}
              </Button>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Nur Administratoren können das Firmenprofil bearbeiten.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
