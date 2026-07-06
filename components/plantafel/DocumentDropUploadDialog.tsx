'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Upload, X, FileText, Image as ImageIcon, Loader2, ArrowRight } from 'lucide-react'

interface Props {
  open: boolean
  projectId: string
  projectName?: string
  initialFiles?: File[]
  onClose: () => void
  /** Nach erfolgreichem Upload: Parent öffnet den Editor auf dem Dokumente-Tab */
  onUploaded: () => void
}

interface PendingFile {
  key: string
  file: File
  name: string
  notiz: string
  previewUrl: string | null
  loading: boolean
}

const ALLOWED_ACCEPT =
  'image/*,.pdf,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.zip'

function fileKey(file: File): string {
  return `${file.name}-${file.size}-${file.lastModified}`
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function isImage(file: File): boolean {
  return file.type.startsWith('image/')
}

export default function DocumentDropUploadDialog({
  open,
  projectId,
  projectName,
  initialFiles,
  onClose,
  onUploaded,
}: Props) {
  const [pending, setPending] = useState<PendingFile[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  // Alle erzeugten Object-URLs sammeln, um sie beim Unmount freizugeben
  const objectUrlsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    const urls = objectUrlsRef.current
    return () => {
      urls.forEach((u) => URL.revokeObjectURL(u))
      urls.clear()
    }
  }, [])

  // Datei zur Liste hinzufügen: Vorschau erzeugen + kurze Lade-Animation
  const addFiles = useCallback((incoming: File[]) => {
    setPending((prev) => {
      const existing = new Set(prev.map((p) => p.key))
      const toAdd = incoming
        .filter((f) => !existing.has(fileKey(f)))
        .map<PendingFile>((f) => {
          const previewUrl = isImage(f) ? URL.createObjectURL(f) : null
          if (previewUrl) objectUrlsRef.current.add(previewUrl)
          return {
            key: fileKey(f),
            file: f,
            name: f.name,
            notiz: '',
            previewUrl,
            loading: true,
          }
        })
      return [...prev, ...toAdd]
    })
  }, [])

  // Beim Öffnen die gedroppten Dateien übernehmen
  useEffect(() => {
    if (open && initialFiles && initialFiles.length > 0) {
      addFiles(initialFiles)
    }
    if (!open) {
      setPending((prev) => {
        prev.forEach((p) => { if (p.previewUrl) URL.revokeObjectURL(p.previewUrl) })
        return []
      })
      setError('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialFiles])

  // Lade-Animation der Proxy-Vorschau auflösen (kurz verzögert)
  useEffect(() => {
    const loadingKeys = pending.filter((p) => p.loading).map((p) => p.key)
    if (loadingKeys.length === 0) return
    const timer = setTimeout(() => {
      setPending((prev) => prev.map((p) => (loadingKeys.includes(p.key) ? { ...p, loading: false } : p)))
    }, 700)
    return () => clearTimeout(timer)
  }, [pending])

  const updateField = (key: string, field: 'name' | 'notiz', value: string) => {
    setPending((prev) => prev.map((p) => (p.key === key ? { ...p, [field]: value } : p)))
  }

  const removeFile = (key: string) => {
    setPending((prev) => {
      const target = prev.find((p) => p.key === key)
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl)
      return prev.filter((p) => p.key !== key)
    })
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    const dropped = Array.from(e.dataTransfer.files || [])
    if (dropped.length) addFiles(dropped)
  }

  const handleWeiter = async () => {
    if (pending.length === 0 || !projectId) return
    setIsUploading(true)
    setError('')
    try {
      const formData = new FormData()
      const names: string[] = []
      const descriptions: string[] = []
      pending.forEach((p) => {
        formData.append('files', p.file)
        formData.append('names', p.name.trim() || p.file.name)
        formData.append('descriptions', p.notiz.trim())
        names.push(p.name.trim() || p.file.name)
        descriptions.push(p.notiz.trim())
      })
      formData.set('namesJson', JSON.stringify(names))
      formData.set('descriptionsJson', JSON.stringify(descriptions))
      const res = await fetch(`/api/projects/${projectId}/documents`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.success) {
        setError(json.message || 'Upload fehlgeschlagen. Bitte erneut versuchen.')
        return
      }
      onUploaded()
    } catch {
      setError('Upload fehlgeschlagen. Bitte erneut versuchen.')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[92vw] max-w-2xl max-h-[90vh] rounded-2xl flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="shrink-0 px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-700">
          <DialogTitle className="text-lg font-semibold">
            Dokumente hinzufügen{projectName ? ` · ${projectName}` : ''}
          </DialogTitle>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Name und Notiz vergeben, weitere Dateien möglich – danach mit „Weiter" ablegen.
          </p>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-3">
          {pending.map((p) => (
            <div
              key={p.key}
              className="flex gap-3 rounded-xl border border-slate-200 dark:border-slate-700 p-3"
            >
              {/* Proxy-Vorschau mit Lade-Animation */}
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center justify-center">
                {p.loading ? (
                  <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                  </div>
                ) : p.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.previewUrl} alt={p.name} className="h-full w-full object-cover" />
                ) : isImage(p.file) ? (
                  <ImageIcon className="h-8 w-8 text-slate-400" />
                ) : (
                  <FileText className="h-8 w-8 text-slate-400" />
                )}
              </div>

              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1 space-y-1">
                    <Label className="text-xs">Name</Label>
                    <Input
                      value={p.name}
                      onChange={(e) => updateField(p.key, 'name', e.target.value)}
                      placeholder="Dokumentname"
                      className="h-8 text-sm"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-slate-400 hover:text-red-600"
                    onClick={() => removeFile(p.key)}
                    aria-label="Entfernen"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Notiz</Label>
                  <Input
                    value={p.notiz}
                    onChange={(e) => updateField(p.key, 'notiz', e.target.value)}
                    placeholder="Optionale Notiz…"
                    className="h-8 text-sm"
                  />
                </div>
                <p className="text-[11px] text-slate-400">{formatSize(p.file.size)}</p>
              </div>
            </div>
          ))}

          {/* Dropzone für weitere Dateien */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true) }}
            onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false) }}
            onDrop={handleDrop}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click() } }}
            className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 cursor-pointer transition-colors ${
              isDragging
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
                : 'border-slate-300 dark:border-slate-600 hover:border-slate-400 bg-slate-50 dark:bg-slate-800/50'
            }`}
          >
            <Upload className="h-7 w-7 text-slate-400 mb-1.5" />
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Weitere Dateien hierher ziehen oder <span className="text-blue-600 underline">durchsuchen</span>
            </p>
            <p className="text-xs text-slate-400 mt-0.5">Bilder, PDF, Word, ZIP</p>
          </div>

          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ALLOWED_ACCEPT}
            className="hidden"
            onChange={(e) => {
              const selected = Array.from(e.target.files || [])
              if (selected.length) addFiles(selected)
              e.target.value = ''
            }}
          />

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>

        <DialogFooter className="shrink-0 flex justify-between gap-3 px-6 py-4 border-t border-slate-100 dark:border-slate-700">
          <Button variant="outline" type="button" onClick={onClose} disabled={isUploading}>
            Abbrechen
          </Button>
          <Button
            type="button"
            className="bg-blue-700 text-white hover:bg-blue-800"
            onClick={handleWeiter}
            disabled={isUploading || pending.length === 0}
          >
            {isUploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <ArrowRight className="h-4 w-4 mr-1" />}
            {isUploading ? 'Lädt hoch…' : 'Weiter'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
