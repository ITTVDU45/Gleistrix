'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Eye, Download, Trash2, FileText } from 'lucide-react'
import DocumentDropUploadDialog from '../DocumentDropUploadDialog'
import type { Project } from '../../../types'

interface DocumentItem {
  id: string
  name: string
  description?: string
  url?: string
}

interface DokumenteTabProps {
  project: Project
  onChanged: () => void
}

export default function DokumenteTab({ project, onChanged }: DokumenteTabProps) {
  const projectId = project.id
  const [uploadOpen, setUploadOpen] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const documents = useMemo<DocumentItem[]>(() => {
    const all = (project as unknown as { dokumente?: { all?: DocumentItem[] } }).dokumente?.all
    return Array.isArray(all) ? all : []
  }, [project])

  const [notizDraft, setNotizDraft] = useState<Record<string, string>>({})

  const saveNotiz = async (docId: string, value: string) => {
    try {
      await fetch(`/api/projects/${projectId}/documents/${docId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: value }),
      })
      onChanged()
    } catch {
      // still keep the local draft; user can retry
    }
  }

  const handleDelete = async (docId: string) => {
    if (confirmDeleteId !== docId) {
      setConfirmDeleteId(docId)
      return
    }
    try {
      await fetch(`/api/projects/${projectId}/documents/${docId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      setConfirmDeleteId(null)
      onChanged()
    } catch {
      setConfirmDeleteId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
          Projektdokumente
        </p>
        <Button size="sm" onClick={() => setUploadOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Dokumente hinzufügen
        </Button>
      </div>

      {documents.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 dark:border-slate-700 py-10 text-center">
          <FileText className="h-8 w-8 text-slate-400 mb-2" />
          <p className="text-sm text-slate-500 dark:text-slate-400">Keine Dokumente vorhanden</p>
          <p className="text-xs text-slate-400 mt-0.5">Dateien per Drag &amp; Drop auf die Projektkarte ziehen oder hier hinzufügen.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 dark:bg-slate-700/50">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-slate-600 dark:text-slate-300">Name</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-600 dark:text-slate-300">Notiz</th>
                <th className="px-3 py-2 text-right font-semibold text-slate-600 dark:text-slate-300">Aktionen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {documents.map((doc) => (
                <tr key={doc.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                  <td className="px-3 py-2 align-top">
                    <span className="flex items-center gap-2 text-slate-800 dark:text-slate-200">
                      <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                      <span className="break-words">{doc.name}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <Input
                      value={notizDraft[doc.id] ?? doc.description ?? ''}
                      onChange={(e) => setNotizDraft((p) => ({ ...p, [doc.id]: e.target.value }))}
                      onBlur={(e) => {
                        const val = e.target.value
                        if (val !== (doc.description ?? '')) saveNotiz(doc.id, val)
                      }}
                      placeholder="Notiz hinzufügen…"
                      className="h-8 text-sm"
                    />
                  </td>
                  <td className="px-3 py-2 align-top">
                    <div className="flex items-center justify-end gap-1">
                      <a
                        href={`/api/projects/${projectId}/documents/${doc.id}/content?disposition=inline`}
                        target="_blank"
                        rel="noreferrer"
                        title="Vorschau"
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                      >
                        <Eye className="h-4 w-4" />
                      </a>
                      <a
                        href={`/api/projects/${projectId}/documents/${doc.id}/content?disposition=attachment`}
                        title="Herunterladen"
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
                      >
                        <Download className="h-4 w-4" />
                      </a>
                      <button
                        type="button"
                        onClick={() => handleDelete(doc.id)}
                        title="Löschen"
                        className="inline-flex h-7 items-center justify-center rounded-md px-2 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                      >
                        {confirmDeleteId === doc.id ? (
                          <span className="text-xs">Wirklich?</span>
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <DocumentDropUploadDialog
        open={uploadOpen}
        projectId={projectId}
        projectName={project.name}
        onClose={() => setUploadOpen(false)}
        onUploaded={() => {
          setUploadOpen(false)
          onChanged()
        }}
      />
    </div>
  )
}
