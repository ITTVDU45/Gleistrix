'use client'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { logger } from '@/lib/logger'
import { getErrorMessage } from '@/lib/errors'
import { getJSON } from '@/lib/http/apiClient'
import { fetchWithIntent } from '@/lib/http/fetchWithIntent'
import { formatDate } from '@/lib/subunternehmen/format'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Download, FolderOpen, Trash2, Upload } from 'lucide-react'

interface CompanyDocument {
  id: string
  type: string
  name: string
  contentType?: string
  size?: number
  uploadedByName?: string
  source: 'subcontractor' | 'internal'
  createdAt?: string
}

const DOC_TYPE_LABELS: Record<string, string> = {
  INVOICE_PDF: 'Rechnungs-PDF',
  INVOICE_ATTACHMENT: 'Rechnungsanhang',
  TIMESHEET: 'Stundennachweis',
  SERVICE_PROOF: 'Leistungsnachweis',
  CERTIFICATE: 'Zertifikat',
  QUALIFICATION: 'Qualifikationsnachweis',
  PROJECT_DOCUMENT: 'Projektdokument',
  OTHER: 'Sonstiges',
  INTERNAL_REVIEW: 'Interne Prüfunterlage',
}

/** Dokumenttypen, die intern bereitgestellt werden können */
const ADMIN_UPLOAD_TYPES = ['PROJECT_DOCUMENT', 'CERTIFICATE', 'OTHER', 'INTERNAL_REVIEW']

type Props = {
  subcompanyId: string
}

/**
 * Admin-Verwaltung der Dokumente eines Subunternehmens im Stammdaten-Dialog:
 * bereitstellen (sichtbar im Portal, außer „Interne Prüfunterlage"),
 * herunterladen und löschen.
 */
export default function SubcompanyDocumentsManager({ subcompanyId }: Props) {
  const [documents, setDocuments] = useState<CompanyDocument[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadType, setUploadType] = useState('PROJECT_DOCUMENT')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await getJSON<{ documents: CompanyDocument[] }>(
        `/api/subcompanies/${subcompanyId}/documents`
      )
      setDocuments(data.documents || [])
    } catch (err) {
      logger.error('Subunternehmen-Dokumente konnten nicht geladen werden', err)
      setError(getErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }, [subcompanyId])

  useEffect(() => {
    load()
  }, [load])

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setNotice('')
    const file = fileInputRef.current?.files?.[0]
    if (!file) {
      setError('Bitte eine Datei auswählen')
      return
    }
    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', uploadType)
      const res = await fetchWithIntent(`/api/subcompanies/${subcompanyId}/documents`, {
        method: 'POST',
        intent: 'sub:document-upload',
        body: formData,
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error || 'Upload fehlgeschlagen')
        return
      }
      setNotice(
        uploadType === 'INTERNAL_REVIEW'
          ? `„${file.name}" gespeichert (nur intern sichtbar).`
          : `„${file.name}" bereitgestellt – im Portal sichtbar.`
      )
      if (fileInputRef.current) fileInputRef.current.value = ''
      await load()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setIsUploading(false)
    }
  }

  const handleDelete = async (doc: CompanyDocument) => {
    if (!confirm(`Dokument „${doc.name}" wirklich löschen?`)) return
    setError('')
    try {
      const res = await fetchWithIntent(`/api/subcompanies/${subcompanyId}/documents/${doc.id}`, {
        method: 'DELETE',
        intent: 'sub:document-delete',
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error || 'Löschen fehlgeschlagen')
        return
      }
      await load()
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleUpload} className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2 items-end">
        <div className="space-y-1">
          <Label className="text-xs text-slate-600 dark:text-slate-400">Datei bereitstellen</Label>
          <Input
            ref={fileInputRef}
            type="file"
            className="h-10 rounded-xl"
            accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-slate-600 dark:text-slate-400">Typ</Label>
          <Select value={uploadType} onValueChange={setUploadType}>
            <SelectTrigger className="h-10 rounded-xl min-w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ADMIN_UPLOAD_TYPES.map((t) => (
                <SelectItem key={t} value={t}>{DOC_TYPE_LABELS[t]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          type="submit"
          disabled={isUploading}
          className="h-10 bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
        >
          <Upload className="h-4 w-4 mr-2" />
          {isUploading ? 'Lädt…' : 'Hochladen'}
        </Button>
      </form>

      {error && (
        <Alert variant="destructive" className="rounded-xl">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {notice && (
        <Alert className="rounded-xl bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800">
          <AlertDescription className="text-green-800 dark:text-green-300">{notice}</AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="flex justify-center py-6">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
        </div>
      ) : documents.length === 0 ? (
        <div className="text-center py-6">
          <FolderOpen className="h-8 w-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
          <p className="text-sm text-slate-500 dark:text-slate-400">Noch keine Dokumente vorhanden.</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 dark:border-slate-700 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{doc.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge className="rounded-md px-1.5 py-0 text-[10px] bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                    {DOC_TYPE_LABELS[doc.type] || doc.type}
                  </Badge>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    {doc.source === 'internal' ? 'intern bereitgestellt' : 'Upload des Subunternehmens'} ·{' '}
                    {formatDate(doc.createdAt)}
                  </span>
                </div>
              </div>
              <div className="flex shrink-0">
                <Button variant="ghost" size="sm" asChild title="Herunterladen">
                  <a href={`/api/subcompanies/${subcompanyId}/documents/${doc.id}`}>
                    <Download className="h-4 w-4 text-blue-600" />
                  </a>
                </Button>
                {doc.type !== 'INVOICE_PDF' && (
                  <Button variant="ghost" size="sm" title="Löschen" onClick={() => handleDelete(doc)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
