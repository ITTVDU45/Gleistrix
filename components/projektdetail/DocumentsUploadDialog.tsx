"use client";
import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Upload, X, FileText, Image } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpload: (files: FileList, description?: string) => Promise<void>;
  projectId: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function isImageType(type: string): boolean {
  return type.startsWith('image/');
}

function getFileKey(file: File): string {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

export default function DocumentsUploadDialog({ open, onOpenChange, onUpload, projectId }: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [descriptions, setDescriptions] = useState<Record<string, string>>({});
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = (newFiles: FileList | File[]) => {
    const list = Array.isArray(newFiles) ? newFiles : Array.from(newFiles);
    setFiles(prev => {
      const names = new Set(prev.map(f => f.name + f.size + f.lastModified));
      const toAdd = list.filter(f => !names.has(f.name + f.size + f.lastModified));
      return prev.concat(toAdd);
    });
  };

  const setDescriptionForFile = (fileKey: string, value: string) => {
    setDescriptions(prev => ({ ...prev, [fileKey]: value }));
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const dropped = e.dataTransfer.files;
    if (dropped?.length) addFiles(dropped);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (selected?.length) addFiles(selected);
    e.target.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (files.length === 0) return;
    setIsUploading(true);
    try {
      const presignRes = await fetch(`/api/projects/${projectId}/documents/presign-upload`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: files.map(f => ({ name: f.name, contentType: f.type })) })
      });
      let presignJson: any;
      if (!presignRes.ok) {
        const txt = await presignRes.text().catch(() => '');
        console.error('Presign upload endpoint returned error', presignRes.status, txt);
        alert('Presign fehlgeschlagen: ' + (txt || presignRes.status));
        setIsUploading(false);
        return;
      }
      try {
        presignJson = await presignRes.json();
      } catch (err) {
        console.error('Presign response not JSON', err);
        alert('Presign fehlgeschlagen: ungültige Antwort');
        setIsUploading(false);
        return;
      }
      if (!presignJson?.uploads) {
        console.error('Presign returned no uploads', presignJson);
        alert('Presign: keine Upload-URLs erhalten');
        setIsUploading(false);
        return;
      }

      for (const upload of presignJson.uploads) {
        const file = files.find(f => f.name === upload.name);
        if (!file) continue;
        try {
          const res = await fetch(upload.presignedUrl, { method: 'PUT', headers: { 'Content-Type': upload.contentType }, body: file });
          if (!res.ok) {
            const t = await res.text().catch(() => '');
            console.error('Upload to presigned URL failed', res.status, t);
            alert('Upload fehlgeschlagen für ' + upload.name);
            setIsUploading(false);
            return;
          }
        } catch (err) {
          console.error('Upload error', err);
          alert('Upload error: ' + (err instanceof Error ? err.message : String(err)));
          setIsUploading(false);
          return;
        }
      }

      const documentsWithDescriptions = presignJson.uploads.map((u: any, i: number) => ({
        name: u.name,
        url: u.url,
        description: descriptions[getFileKey(files[i])] ?? ''
      }));
      const committed = await fetch(`/api/projects/${projectId}/documents/commit`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documents: documentsWithDescriptions })
      }).then(r => r.json());
      if (!committed?.success) {
        console.warn('Commit failed', committed);
      } else if (committed.added && onUpload) {
        try {
          const dt = new DataTransfer();
          files.forEach(f => dt.items.add(f));
          await onUpload(dt.files);
        } catch (e) {}
      }
      setFiles([]);
      setDescriptions({});
      onOpenChange(false);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[92vw] max-w-6xl max-h-[90vh] rounded-2xl border-0 shadow-2xl bg-white dark:bg-slate-800 flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="shrink-0 pb-4 pt-6 px-6 border-b border-slate-100 dark:border-slate-700">
          <DialogTitle className="text-xl font-semibold">Dokumente hochladen</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            accept="image/*,.pdf,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.zip"
            onChange={handleFileInputChange}
          />
          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Dateien</label>
            <div
              role="button"
              tabIndex={0}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current?.click(); } }}
              className={`
                relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 min-h-[160px]
                transition-colors cursor-pointer
                ${isDragging
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-500'
                  : 'border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500 bg-slate-50 dark:bg-slate-800/50'
                }
              `}
            >
              <Upload className="w-10 h-10 text-slate-400 dark:text-slate-500 mb-2" />
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400 text-center">
                Dateien hierher ziehen oder <span className="text-blue-600 dark:text-blue-400 underline">durchsuchen</span>
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                Bilder, PDF, Word, ZIP
              </p>
            </div>
          </div>

          {files.length > 0 && (
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Ausgewählte Dateien ({files.length})</p>
              <ul className="space-y-4 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50 p-3">
                {files.map((file, index) => {
                  const fileKey = getFileKey(file);
                  return (
                    <li
                      key={fileKey}
                      className="rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 px-4 py-3 space-y-2"
                    >
                      <div className="flex items-center gap-3">
                        {isImageType(file.type) ? (
                          <Image className="w-8 h-8 shrink-0 text-slate-400" />
                        ) : (
                          <FileText className="w-8 h-8 shrink-0 text-slate-400" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-800 dark:text-slate-200 break-words" title={file.name}>{file.name}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{formatSize(file.size)}</p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="shrink-0 h-8 w-8 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                          onClick={() => removeFile(index)}
                          aria-label={`${file.name} entfernen`}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                      <Input
                        value={descriptions[fileKey] ?? ''}
                        onChange={(e) => setDescriptionForFile(fileKey, e.target.value)}
                        placeholder="Beschreibung (optional) – z.B. Sicherheitsplan, Baufortschritt …"
                        className="w-full text-sm min-h-[2.5rem]"
                      />
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          </div>
          <DialogFooter className="shrink-0 flex justify-end gap-3 px-6 py-4 border-t border-slate-100 dark:border-slate-700">
            <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>Abbrechen</Button>
            <Button type="submit" className="bg-blue-700 text-white hover:bg-blue-800" disabled={isUploading || files.length === 0}>
              {isUploading ? 'Lädt hoch...' : 'Hochladen'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
