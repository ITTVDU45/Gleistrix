"use client";
import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { logger } from '@/lib/logger'
import { getErrorMessage } from '@/lib/errors'
import { SubPortalApi, type PortalProjectListItem } from '@/lib/api/subunternehmenPortal'
import { fetchWithIntent } from '@/lib/http/fetchWithIntent'
import type { SubcontractorDocumentDto } from '@/types/subunternehmen'
import { formatDate } from '@/lib/subunternehmen/format'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Download, FolderOpen, Trash2, Upload } from 'lucide-react'

const DOC_TYPE_LABELS: Record<string, string> = {
  INVOICE_PDF: 'Rechnungs-PDF',
  INVOICE_ATTACHMENT: 'Rechnungsanhang',
  TIMESHEET: 'Stundennachweis',
  SERVICE_PROOF: 'Leistungsnachweis',
  CERTIFICATE: 'Zertifikat',
  QUALIFICATION: 'Qualifikationsnachweis',
  PROJECT_DOCUMENT: 'Projektdokument',
  OTHER: 'Sonstiges',
}

const UPLOAD_TYPES = ['TIMESHEET', 'SERVICE_PROOF', 'CERTIFICATE', 'QUALIFICATION', 'INVOICE_ATTACHMENT', 'OTHER']
const ALL = 'alle'

function DokumenteInner() {
  const searchParams = useSearchParams()
  const initialProjectId = searchParams.get('projectId') || ALL

  const [documents, setDocuments] = useState<SubcontractorDocumentDto[]>([])
  const [projects, setProjects] = useState<PortalProjectListItem[]>([])
  const [projectFilter, setProjectFilter] = useState(initialProjectId)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const [uploadType, setUploadType] = useState('SERVICE_PROOF')
  const [uploadProjectId, setUploadProjectId] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const [docsData, projectsData] = await Promise.all([
        SubPortalApi.documents(),
        SubPortalApi.projects(),
      ])
      setDocuments(docsData.documents || [])
      setProjects(projectsData.projects || [])
    } catch (err) {
      logger.error('Portal: Dokumente konnten nicht geladen werden', err)
      setError(getErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(
    () => (projectFilter === ALL ? documents : documents.filter((d) => d.projectId === projectFilter)),
    [documents, projectFilter]
  )

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
      if (uploadProjectId) formData.append('projectId', uploadProjectId)
      const res = await fetchWithIntent('/api/subunternehmen/documents', {
        method: 'POST',
        intent: 'sub:document-upload',
        body: formData,
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error || 'Upload fehlgeschlagen')
        return
      }
      setNotice(`„${file.name}" wurde hochgeladen.`)
      if (fileInputRef.current) fileInputRef.current.value = ''
      await load()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setIsUploading(false)
    }
  }

  const handleDelete = async (doc: SubcontractorDocumentDto) => {
    if (!confirm(`Dokument „${doc.name}" wirklich löschen?`)) return
    try {
      const result = await SubPortalApi.deleteDocument(doc.id)
      if (result.error) {
        setError(result.error)
        return
      }
      await load()
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }

  const projectNameById = useMemo(
    () => new Map(projects.map((p) => [p.id, p.name])),
    [projects]
  )

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">Dokumente</h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">
          Leistungsnachweise, Zertifikate und freigegebene Projektdokumente
        </p>
      </div>

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

      {/* Upload */}
      <Card className="border-0 shadow-lg bg-white dark:bg-slate-800 rounded-2xl">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Upload className="h-5 w-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Dokument hochladen</h3>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpload} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            <div className="space-y-2">
              <Label>Datei</Label>
              <Input ref={fileInputRef} type="file" className="h-11 rounded-xl" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx" />
            </div>
            <div className="space-y-2">
              <Label>Dokumenttyp</Label>
              <Select value={uploadType} onValueChange={setUploadType}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UPLOAD_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{DOC_TYPE_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Projekt (optional)</Label>
              <Select value={uploadProjectId || 'keins'} onValueChange={(v) => setUploadProjectId(v === 'keins' ? '' : v)}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="keins">Ohne Projektbezug</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="submit"
              disabled={isUploading}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-11"
            >
              <Upload className="h-4 w-4 mr-2" />
              {isUploading ? 'Wird hochgeladen…' : 'Hochladen'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Liste */}
      <Card className="border-0 shadow-lg bg-white dark:bg-slate-800 rounded-2xl">
        <CardHeader>
          <div className="max-w-xs">
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="Projekt" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Alle Projekte</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <FolderOpen className="h-10 w-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-slate-500 dark:text-slate-400">Keine Dokumente vorhanden.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Typ</TableHead>
                    <TableHead>Projekt</TableHead>
                    <TableHead>Quelle</TableHead>
                    <TableHead>Datum</TableHead>
                    <TableHead className="text-right">Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((doc) => (
                    <TableRow key={doc.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                      <TableCell className="font-medium max-w-[280px] truncate">{doc.name}</TableCell>
                      <TableCell>
                        <Badge className="rounded-lg px-2 py-0.5 text-xs bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                          {DOC_TYPE_LABELS[doc.type] || doc.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm max-w-[200px] truncate">
                        {doc.projectId ? projectNameById.get(doc.projectId) || '–' : '–'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {doc.source === 'internal' ? 'Bereitgestellt' : 'Eigener Upload'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">{formatDate(doc.createdAt)}</TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button variant="ghost" size="sm" asChild title="Herunterladen">
                          <a href={SubPortalApi.documentDownloadUrl(doc.id)}>
                            <Download className="h-4 w-4 text-blue-600" />
                          </a>
                        </Button>
                        {doc.source === 'subcontractor' && doc.type !== 'INVOICE_PDF' && (
                          <Button variant="ghost" size="sm" title="Löschen" onClick={() => handleDelete(doc)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
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
  )
}

export default function PortalDokumentePage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>}>
      <DokumenteInner />
    </Suspense>
  )
}
