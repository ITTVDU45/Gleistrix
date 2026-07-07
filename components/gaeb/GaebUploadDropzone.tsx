'use client'

import { useRef, useState } from 'react'
import { Upload, Loader2, AlertTriangle } from 'lucide-react'
import { GaebApi, type GaebUploadResult } from '@/lib/api/gaeb'
import { GAEB_ALLOWED_EXTENSIONS } from '@/lib/gaeb/upload'

interface GaebUploadDropzoneProps {
  onUploaded: (result: GaebUploadResult) => void
  disabled?: boolean
}

const ACCEPT = GAEB_ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(',')

export default function GaebUploadDropzone({ onUploaded, disabled }: GaebUploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState('')

  const handleFile = async (file: File) => {
    setIsUploading(true)
    setError('')
    try {
      const res = await GaebApi.upload(file)
      onUploaded(res.data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload fehlgeschlagen')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="space-y-2">
      <div
        role="button"
        tabIndex={0}
        aria-disabled={disabled}
        onClick={() => !disabled && !isUploading && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !disabled && !isUploading) {
            e.preventDefault()
            inputRef.current?.click()
          }
        }}
        onDragOver={(e) => {
          if (disabled) return
          e.preventDefault()
          e.stopPropagation()
          setIsDragging(true)
        }}
        onDragLeave={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setIsDragging(false)
        }}
        onDrop={(e) => {
          if (disabled) return
          e.preventDefault()
          e.stopPropagation()
          setIsDragging(false)
          const f = e.dataTransfer.files?.[0]
          if (f) handleFile(f)
        }}
        className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
          disabled
            ? 'cursor-not-allowed border-slate-200 bg-slate-50 opacity-60 dark:border-slate-700 dark:bg-slate-800/40'
            : isDragging
              ? 'cursor-pointer border-blue-500 bg-blue-50 dark:border-blue-500 dark:bg-blue-950/30'
              : 'cursor-pointer border-slate-300 bg-slate-50 hover:border-slate-400 dark:border-slate-600 dark:bg-slate-800/50'
        }`}
      >
        {isUploading ? (
          <>
            <Loader2 className="mb-2 h-7 w-7 animate-spin text-blue-600" />
            <p className="text-sm text-slate-600 dark:text-slate-300">Datei wird hochgeladen…</p>
          </>
        ) : (
          <>
            <Upload className="mb-2 h-7 w-7 text-slate-400" />
            <p className="text-sm text-slate-600 dark:text-slate-300">
              GAEB-Datei hierher ziehen oder <span className="text-blue-600 underline">durchsuchen</span>
            </p>
            <p className="mt-1 text-xs text-slate-400">GAEB DA XML (.xml, .x8x, .p8x, .d8x)</p>
          </>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) handleFile(f)
          e.target.value = ''
        }}
      />

      {error && (
        <p className="flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </p>
      )}
    </div>
  )
}
