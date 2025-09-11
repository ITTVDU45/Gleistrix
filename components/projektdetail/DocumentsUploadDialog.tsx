"use client";
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpload: (files: FileList, description?: string) => Promise<void>;
  projectId: string;
}

export default function DocumentsUploadDialog({ open, onOpenChange, onUpload, projectId }: Props) {
  const [files, setFiles] = useState<FileList | null>(null);
  const [description, setDescription] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!files) return;
    setIsUploading(true);
    try {
      // Presign-upload flow: request presigned PUT URLs, upload directly to MinIO, then call metadata endpoint
      const fileList = Array.from(files);
      const presignRes = await fetch(`/api/projects/${projectId}/documents/presign-upload`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: fileList.map(f => ({ name: f.name, contentType: f.type })) })
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
      } catch (e) {
        console.error('Presign response not JSON', e);
        const txt = await presignRes.text().catch(() => '');
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

      // upload each file via PUT to the presigned URL
      for (const upload of presignJson.uploads) {
        const file = fileList.find(f => f.name === upload.name);
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

      // Commit metadata to server via commit endpoint
      const committed = (await fetch(`/api/projects/${projectId}/documents/commit`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documents: presignJson.uploads.map((u: any) => ({ name: u.name, url: u.url, description })) })
      }).then(r => r.json()));
      if (!committed?.success) {
        console.warn('Commit failed', committed);
      } else {
        // If server returned added docs with real IDs, inform parent with those
        if (committed.added) {
          try {
            // parent can refetch
            if (onUpload) await onUpload(files as FileList, description);
          } catch (e) {}
        }
      }
      setFiles(null);
      setDescription('');
    } finally {
      setIsUploading(false);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg rounded-2xl border-0 shadow-2xl bg-white dark:bg-slate-800 max-h-[85vh] overflow-y-auto">
        <DialogHeader className="pb-4 border-b border-slate-100 dark:border-slate-700">
          <DialogTitle className="text-xl font-semibold">Dokumente hochladen</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">Dateien</label>
            <Input type="file" multiple onChange={(e: any) => setFiles(e.target.files)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Beschreibung (optional)</label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="z.B. Sicherheitsplan" />
          </div>
          <DialogFooter className="flex justify-end gap-3">
            <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>Abbrechen</Button>
            <Button type="submit" className="bg-blue-700 text-white" disabled={isUploading || !files}>{isUploading ? 'Lädt hoch...' : 'Hochladen'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}


