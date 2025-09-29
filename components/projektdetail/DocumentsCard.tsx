"use client";
import React from 'react';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Table, TableBody, TableCell, TableHeader, TableHead, TableRow } from '../../components/ui/table';
import DocumentsUploadDialog from './DocumentsUploadDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { ProjectsApi } from '@/lib/api/projects';

interface DocumentItem {
  id: string;
  name: string;
  description?: string;
  url?: string;
}

interface DocumentsCardProps {
  projectId: string;
  documents?: DocumentItem[];
  onUpload?: (files: FileList, description?: string) => Promise<void>;
  onUpdateDescription?: (docId: string, description: string) => Promise<void>;
}

export default function DocumentsCard({ projectId, documents = [], onUpload, onUpdateDescription }: DocumentsCardProps) {
  const [openUpload, setOpenUpload] = React.useState(false);
  const [localDocs, setLocalDocs] = React.useState<DocumentItem[]>(documents);

  React.useEffect(() => {
    setLocalDocs(documents);
  }, [documents]);

  // Log incoming prop for debugging
  React.useEffect(() => {
  }, [documents]);

  // Debug: log when documents change to help trace UI updates
  React.useEffect(() => {
  }, [projectId, localDocs]);

  // Wenn keine docs übergeben, lade aktuelle Projektdokumente vom Server
  React.useEffect(() => {
    const fetchProjectDocs = async () => {
      try {
        // Wenn Parent bereits docs übergibt, nichts tun
        if (documents && documents.length > 0) return;
        if (!projectId) return;
        // Hole Projekt direkt mit credentials, da ProjectsApi.get wrappers unterschiedliche Shapes zurückgeben können
        const resRaw = await fetch(`/api/projects/${projectId}`, { credentials: 'include' });
        if (!resRaw.ok) {
          console.warn('Failed to fetch project docs, status=', resRaw.status);
          return;
        }
        const pj = await resRaw.json();
        const projectObj = pj && pj.project ? pj.project : pj;
        if (projectObj && projectObj.dokumente && Array.isArray(projectObj.dokumente.all)) {
          setLocalDocs(projectObj.dokumente.all);
        }
      } catch (e) {
        console.warn('Failed to fetch project docs', e);
      }
    };
    fetchProjectDocs();
  }, [projectId, documents]);

  const handleUploaded = async (files: FileList, description?: string) => {
    if (onUpload) await onUpload(files, description);
    // Nach erfolgreichem Commit: hole aktuellen Projektstand vom Server und aktualisiere lokale Liste
    try {
      const res = await fetch(`/api/projects/${projectId}`, { credentials: 'include' });
      if (res.ok) {
        const projectJson = await res.json();
        const docs = (projectJson as any).dokumente?.all || (projectJson as any).project?.dokumente?.all || [];
        setLocalDocs(docs);
      } else {
        // Optimistisches Update als Fallback
        const added = Array.from(files).map(f => ({ id: `${Date.now()}-${f.name}`, name: f.name, description }));
        setLocalDocs(prev => [...added, ...prev]);
      }
    } catch (e) {
      const added = Array.from(files).map(f => ({ id: `${Date.now()}-${f.name}`, name: f.name, description }));
      setLocalDocs(prev => [...added, ...prev]);
    }
    setOpenUpload(false);
  };

  const handleDescriptionChange = async (docId: string, value: string) => {
    setLocalDocs(prev => prev.map(d => d.id === docId ? { ...d, description: value } : d));
    if (onUpdateDescription) await onUpdateDescription(docId, value);
  };

  const [deleteCandidate, setDeleteCandidate] = React.useState<string | null>(null);

  const [toDeleteId, setToDeleteId] = React.useState<string | null>(null);

  const handleDelete = (docId: string) => {
    setToDeleteId(docId);
  };

  const handleDeleteConfirmed = async (docId: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/documents/${docId}`, { method: 'DELETE', credentials: 'include' });
      let json: any = null;
      try {
        json = await res.json();
      } catch (parseErr) {
        console.warn('Delete response not JSON', parseErr);
      }
      if (res.ok && json?.success) {
        setLocalDocs(prev => prev.filter(d => d.id !== docId));
        setToDeleteId(null);
      } else {
        console.warn('Delete failed', res.status, json);
        alert('Löschen fehlgeschlagen');
      }
    } catch (e) {
      console.error('Delete error', e);
      alert('Löschen fehlgeschlagen');
    }
  };

  return (
    <Card className="bg-white dark:bg-slate-800 border border-[#C0D4DE] dark:border-slate-700">
      <CardContent className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold">Projektdokumente</h3>
          <div className="flex items-center gap-2">
            <Button size="sm" className="bg-slate-600 hover:bg-slate-700 text-white rounded-xl" onClick={() => setOpenUpload(true)}>
              Dokumente hochladen
            </Button>
          </div>
        </div>

        <div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Beschreibung</TableHead>
                <TableHead>Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {localDocs.length > 0 ? localDocs.map(doc => (
                <TableRow key={doc.id}>
                  <TableCell className="flex items-center">
                    <span>{doc.name}</span>
                  </TableCell>
                  <TableCell>
                    <input
                      className="w-full rounded-lg border border-slate-200 px-3 py-2"
                      value={doc.description || ''}
                      onChange={(e) => handleDescriptionChange(doc.id, e.target.value)}
                      placeholder="Beschreibung hinzufügen"
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <a href={doc.url || '#'} target="_blank" rel="noreferrer" className="text-blue-600" onClick={async (e) => {
                        e.preventDefault();
                        try {
                          const res = await fetch(`/api/projects/${projectId}/documents/${doc.id}/presign`, { credentials: 'include' });
                          const json = await res.json();
                          if (json?.url) window.open(json.url, '_blank');
                        } catch (err) {
                          console.error('Presign failed', err);
                          window.open(doc.url || '#', '_blank');
                        }
                      }}>Anzeigen</a>
                      <button onClick={() => handleDelete(doc.id)} className="text-red-600">Löschen</button>
                    </div>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={3}>
                    <div className="py-2 text-gray-500">Keine Dokumente vorhanden</div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {/* Debug output removed */}
        </div>

        <DocumentsUploadDialog open={openUpload} onOpenChange={setOpenUpload} onUpload={handleUploaded} projectId={projectId} />
        {/* Delete confirmation dialog */}
        <Dialog open={!!toDeleteId} onOpenChange={(open) => { if (!open) setToDeleteId(null); }}>
          <DialogContent className="sm:max-w-md rounded-2xl border-0 shadow-2xl bg-white dark:bg-slate-800">
            <DialogHeader>
              <DialogTitle>Dokument löschen</DialogTitle>
            </DialogHeader>
            <div className="p-4">
              <p className="mt-2 text-sm text-slate-600">Möchten Sie dieses Dokument wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.</p>
            </div>
            <DialogFooter className="flex justify-end gap-3 px-4 pb-4">
              <Button variant="outline" onClick={() => setToDeleteId(null)}>Abbrechen</Button>
              <Button variant="destructive" onClick={async () => { if (toDeleteId) await handleDeleteConfirmed(toDeleteId); }} className="bg-red-600 text-white">Löschen</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}


