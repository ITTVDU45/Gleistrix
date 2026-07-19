"use client";
import React, { useCallback, useEffect, useState } from 'react'
import { logger } from '@/lib/logger'
import { getErrorMessage } from '@/lib/errors'
import { useSubcompanies } from '@/hooks/useSubcompanies'
import {
  SubcontractorInvitesApi,
  type SubcontractorInvite,
} from '@/lib/api/subcontractorInvites'
import type { SubcontractorPermission, SubcontractorRole } from '@/types/subunternehmen'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Building2, Mail, Phone, Send, User, XCircle, RefreshCw } from 'lucide-react'

const PERMISSION_OPTIONS: Array<{ id: SubcontractorPermission; label: string }> = [
  { id: 'subcontractor.projects.read', label: 'Projekte einsehen' },
  { id: 'subcontractor.assignments.read', label: 'Einsätze & Stunden einsehen' },
  { id: 'subcontractor.documents.read', label: 'Dokumente einsehen' },
  { id: 'subcontractor.documents.upload', label: 'Dokumente hochladen' },
  { id: 'subcontractor.invoices.read', label: 'Rechnungen einsehen' },
  { id: 'subcontractor.invoices.create', label: 'Rechnungen vorbereiten' },
  { id: 'subcontractor.invoices.submit', label: 'Rechnungen einreichen' },
  { id: 'subcontractor.company.update', label: 'Unternehmensdaten bearbeiten' },
]

const STATUS_BADGES: Record<SubcontractorInvite['status'], { label: string; className: string }> = {
  pending: { label: 'Ausstehend', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' },
  accepted: { label: 'Angenommen', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
  expired: { label: 'Abgelaufen', className: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300' },
  cancelled: { label: 'Widerrufen', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
}

interface InviteFormState {
  mode: 'existing' | 'new'
  subcontractorCompanyId: string
  newCompanyName: string
  newCompanyEmployeeCount: string
  firstName: string
  lastName: string
  email: string
  phone: string
  subcontractorRole: SubcontractorRole
  permissions: SubcontractorPermission[]
}

const EMPTY_FORM: InviteFormState = {
  mode: 'existing',
  subcontractorCompanyId: '',
  newCompanyName: '',
  newCompanyEmployeeCount: '1',
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  subcontractorRole: 'SUBCONTRACTOR_OWNER',
  permissions: [],
}

/**
 * Admin-Bereich: Subunternehmen einladen + Einladungsstatus verwalten.
 * Verwendet bestehende Subunternehmen-Datensätze (keine Duplikate).
 */
export default function SubcontractorInviteAdmin() {
  const { subcompanies, loading: companiesLoading } = useSubcompanies()
  const [form, setForm] = useState<InviteFormState>(EMPTY_FORM)
  const [invites, setInvites] = useState<SubcontractorInvite[]>([])
  const [isLoadingInvites, setIsLoadingInvites] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [emailWarning, setEmailWarning] = useState('')
  const [fallbackInviteLink, setFallbackInviteLink] = useState('')

  const loadInvites = useCallback(async () => {
    setIsLoadingInvites(true)
    try {
      const data = await SubcontractorInvitesApi.list()
      setInvites(data.invites || [])
    } catch (err) {
      logger.error('Subunternehmen-Einladungen konnten nicht geladen werden', err)
    } finally {
      setIsLoadingInvites(false)
    }
  }, [])

  useEffect(() => {
    loadInvites()
  }, [loadInvites])

  const updateForm = (patch: Partial<InviteFormState>) =>
    setForm((prev) => ({ ...prev, ...patch }))

  const handleSubmit = async (e: React.FormEvent, resend = false) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setEmailWarning('')
    setFallbackInviteLink('')
    setIsSubmitting(true)
    try {
      if (form.mode === 'existing' && !form.subcontractorCompanyId) {
        setError('Bitte ein Subunternehmen auswählen')
        return
      }
      if (form.mode === 'new' && !form.newCompanyName.trim()) {
        setError('Bitte einen Unternehmensnamen angeben')
        return
      }
      const payload = {
        ...(form.mode === 'existing'
          ? { subcontractorCompanyId: form.subcontractorCompanyId }
          : {
              newCompany: {
                name: form.newCompanyName.trim(),
                employeeCount: Math.max(1, parseInt(form.newCompanyEmployeeCount, 10) || 1),
              },
            }),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        subcontractorRole: form.subcontractorRole,
        permissions: form.subcontractorRole === 'SUBCONTRACTOR_USER' ? form.permissions : undefined,
        resend,
      }
      const result = await SubcontractorInvitesApi.create(payload)
      if (result.error) {
        setError(result.error)
        return
      }
      if (result.emailSent === false) {
        // Einladung wurde gespeichert, aber die E-Mail kam nicht raus:
        // SMTP-Fehler deutlich anzeigen + Link zum manuellen Weitergeben
        setEmailWarning(
          `Einladung angelegt, aber die E-Mail konnte nicht zugestellt werden${result.emailError ? `: ${result.emailError}` : '.'}`
        )
        setFallbackInviteLink(result.inviteLink || '')
      } else {
        setSuccess(result.message || 'Einladung versendet')
      }
      setForm(EMPTY_FORM)
      await loadInvites()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRevoke = async (invite: SubcontractorInvite) => {
    if (!confirm(`Einladung für "${invite.email}" (${invite.companyName}) wirklich widerrufen?`)) return
    try {
      const result = await SubcontractorInvitesApi.revoke(invite.id)
      if (result.error) {
        setError(result.error)
        return
      }
      await loadInvites()
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }

  const handleResend = async (invite: SubcontractorInvite) => {
    setError('')
    setSuccess('')
    setEmailWarning('')
    setFallbackInviteLink('')
    try {
      const result = await SubcontractorInvitesApi.create({
        subcontractorCompanyId: invite.companyId,
        firstName: (invite.name || '').split(' ')[0] || 'Ansprechpartner',
        lastName: (invite.name || '').split(' ').slice(1).join(' ') || invite.companyName,
        email: invite.email,
        subcontractorRole: invite.subcontractorRole,
        resend: true,
      })
      if (result.error) {
        setError(result.error)
        return
      }
      if (result.emailSent === false) {
        setEmailWarning(
          `Einladung erneuert, aber die E-Mail konnte nicht zugestellt werden${result.emailError ? `: ${result.emailError}` : '.'}`
        )
        setFallbackInviteLink(result.inviteLink || '')
      } else {
        setSuccess(`Einladung an ${invite.email} erneut versendet`)
      }
      await loadInvites()
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }

  return (
    <div className="space-y-6 mt-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Einladungsformular */}
        <Card className="border-0 shadow-lg bg-white dark:bg-slate-800 rounded-xl">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                <Building2 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Subunternehmen einladen
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Portal-Zugang für ein bestehendes oder neues Subunternehmen
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Subunternehmen *
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={form.mode === 'existing' ? 'default' : 'outline'}
                    className={form.mode === 'existing' ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}
                    onClick={() => updateForm({ mode: 'existing' })}
                  >
                    Bestehendes auswählen
                  </Button>
                  <Button
                    type="button"
                    variant={form.mode === 'new' ? 'default' : 'outline'}
                    className={form.mode === 'new' ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}
                    onClick={() => updateForm({ mode: 'new' })}
                  >
                    Neues anlegen
                  </Button>
                </div>
                {form.mode === 'existing' ? (
                  <Select
                    value={form.subcontractorCompanyId}
                    onValueChange={(v) => updateForm({ subcontractorCompanyId: v })}
                  >
                    <SelectTrigger className="h-11 rounded-xl">
                      <SelectValue
                        placeholder={companiesLoading ? 'Lade Subunternehmen…' : 'Subunternehmen wählen'}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {subcompanies.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <Input
                      className="sm:col-span-2 h-11 rounded-xl"
                      placeholder="Unternehmensname"
                      value={form.newCompanyName}
                      onChange={(e) => updateForm({ newCompanyName: e.target.value })}
                    />
                    <Input
                      className="h-11 rounded-xl"
                      type="number"
                      min={1}
                      placeholder="Mitarbeiter"
                      value={form.newCompanyEmployeeCount}
                      onChange={(e) => updateForm({ newCompanyEmployeeCount: e.target.value })}
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Vorname *</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <Input
                      className="pl-10 h-11 rounded-xl"
                      value={form.firstName}
                      onChange={(e) => updateForm({ firstName: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Nachname *</Label>
                  <Input
                    className="h-11 rounded-xl"
                    value={form.lastName}
                    onChange={(e) => updateForm({ lastName: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">E-Mail *</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <Input
                      type="email"
                      className="pl-10 h-11 rounded-xl"
                      value={form.email}
                      onChange={(e) => updateForm({ email: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Telefon</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <Input
                      className="pl-10 h-11 rounded-xl"
                      value={form.phone}
                      onChange={(e) => updateForm({ phone: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Rolle *</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={form.subcontractorRole === 'SUBCONTRACTOR_OWNER' ? 'default' : 'outline'}
                    className={form.subcontractorRole === 'SUBCONTRACTOR_OWNER' ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}
                    onClick={() => updateForm({ subcontractorRole: 'SUBCONTRACTOR_OWNER' })}
                  >
                    Inhaber (alle Rechte)
                  </Button>
                  <Button
                    type="button"
                    variant={form.subcontractorRole === 'SUBCONTRACTOR_USER' ? 'default' : 'outline'}
                    className={form.subcontractorRole === 'SUBCONTRACTOR_USER' ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}
                    onClick={() => updateForm({ subcontractorRole: 'SUBCONTRACTOR_USER' })}
                  >
                    Mitarbeiter (eingeschränkt)
                  </Button>
                </div>
              </div>

              {form.subcontractorRole === 'SUBCONTRACTOR_USER' && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Berechtigungen (optional)
                  </Label>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Ohne Auswahl gelten die Standardrechte (Lesen, Dokumente, Rechnungen vorbereiten).
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {PERMISSION_OPTIONS.map((perm) => {
                      const checked = form.permissions.includes(perm.id)
                      return (
                        <label
                          key={perm.id}
                          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer transition-colors ${checked ? 'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/20' : 'border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(ch) =>
                              updateForm({
                                permissions: ch
                                  ? [...form.permissions, perm.id]
                                  : form.permissions.filter((p) => p !== perm.id),
                              })
                            }
                          />
                          <span>{perm.label}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              )}

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
              {emailWarning && (
                <Alert className="rounded-lg bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800">
                  <AlertDescription className="text-amber-800 dark:text-amber-300 space-y-2">
                    <p><strong>E-Mail-Versand fehlgeschlagen:</strong> {emailWarning}</p>
                    <p className="text-xs">
                      Bitte SMTP-Zugangsdaten prüfen (EMAIL_PASS in .env.local) und danach
                      „Erneut senden" nutzen – oder den Link unten direkt weitergeben.
                    </p>
                    {fallbackInviteLink && (
                      <div className="flex items-center gap-2">
                        <Input
                          readOnly
                          value={fallbackInviteLink}
                          onFocus={(e) => e.currentTarget.select()}
                          className="h-9 rounded-lg font-mono text-xs bg-white dark:bg-slate-800"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="rounded-lg shrink-0"
                          onClick={() => navigator.clipboard?.writeText(fallbackInviteLink)}
                        >
                          Kopieren
                        </Button>
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-12 shadow-lg hover:shadow-xl transition-all duration-200"
              >
                <Send className="h-4 w-4" />
                {isSubmitting ? 'Einladung wird gesendet…' : 'Einladung senden'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Einladungsliste */}
        <Card className="border-0 shadow-lg bg-white dark:bg-slate-800 rounded-xl">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Subunternehmen-Einladungen
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Status aller versendeten Portal-Einladungen
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={loadInvites} className="rounded-lg">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingInvites ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
              </div>
            ) : invites.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-8">
                Noch keine Subunternehmen-Einladungen versendet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Unternehmen</TableHead>
                      <TableHead>E-Mail</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Aktionen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invites.map((invite) => (
                      <TableRow key={invite.id}>
                        <TableCell className="font-medium">{invite.companyName}</TableCell>
                        <TableCell className="text-sm">{invite.email}</TableCell>
                        <TableCell>
                          <Badge className={`rounded-xl px-3 py-1 ${STATUS_BADGES[invite.status].className}`}>
                            {STATUS_BADGES[invite.status].label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          {(invite.status === 'pending' || invite.status === 'expired') && (
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Erneut senden"
                              onClick={() => handleResend(invite)}
                            >
                              <RefreshCw className="h-4 w-4 text-blue-600" />
                            </Button>
                          )}
                          {invite.status === 'pending' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Widerrufen"
                              onClick={() => handleRevoke(invite)}
                            >
                              <XCircle className="h-4 w-4 text-red-600" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
