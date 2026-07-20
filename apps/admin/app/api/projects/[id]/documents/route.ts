import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import { Project } from '@/lib/models/Project';
import { requireAuth } from '@/lib/security/requireAuth';
import { getCurrentUser } from '@/lib/auth/getCurrentUser';
import minioClient, { getProjectObjectKey } from '@/lib/storage/minioClient';
import { syncProjectDocumentToOneDrive } from '@/lib/services/microsoft/projectDocumentSync';
import stream from 'stream';
import { promisify } from 'util';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await dbConnect();
    const { id } = await params;
    const auth = await requireAuth(request, ['user','admin','superadmin']);
    if (!auth.ok) return NextResponse.json({ message: auth.error }, { status: auth.status });

    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const description = formData.get('description') as string | null;
    const descriptionList = formData.getAll('descriptions').map((v) => String(v ?? ''));
    const descriptionsJsonRaw = formData.get('descriptionsJson') as string | null;
    let descriptionsJson: string[] = [];
    if (descriptionsJsonRaw) {
      try {
        const parsed = JSON.parse(descriptionsJsonRaw);
        if (Array.isArray(parsed)) descriptionsJson = parsed.map((v) => String(v ?? ''));
      } catch {
        // ignore malformed descriptionsJson
      }
    }

    // Optionale eigene Anzeigenamen (überschreiben den Dateinamen)
    const nameList = formData.getAll('names').map((v) => String(v ?? ''));
    const namesJsonRaw = formData.get('namesJson') as string | null;
    let namesJson: string[] = [];
    if (namesJsonRaw) {
      try {
        const parsed = JSON.parse(namesJsonRaw);
        if (Array.isArray(parsed)) namesJson = parsed.map((v) => String(v ?? ''));
      } catch {
        // ignore malformed namesJson
      }
    }

    // Server-side validation
    const MAX_BYTES = Number(process.env.MAX_UPLOAD_SIZE_BYTES || 50 * 1024 * 1024); // default 50 MB
    const allowedTypes = [
      'application/pdf',
      'image/png',
      'image/jpeg',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/zip'
    ];
    for (const f of files as any) {
      const size = (f as any).size || 0;
      const type = (f as any).type || '';
      if (size > MAX_BYTES) {
        return NextResponse.json({ message: `Datei zu groß: ${size} bytes (max ${MAX_BYTES})` }, { status: 413 });
      }
      if (!(allowedTypes.includes(type) || type.startsWith('image/'))) {
        return NextResponse.json({ message: `Unzulässiger Dateityp: ${type}` }, { status: 415 });
      }
    }

    if (!files || files.length === 0) {
      return NextResponse.json({ message: 'Keine Dateien hochgeladen' }, { status: 400 });
    }

    const project = await Project.findById(id);
    if (!project) return NextResponse.json({ message: 'Projekt nicht gefunden' }, { status: 404 });

    if (!project.dokumente || typeof project.dokumente !== 'object') project.dokumente = {};

    const uploaded: any[] = [];
    const bucketName = process.env.MINIO_BUCKET || 'project-documents';
    // Bei gesetztem MINIO_BUCKET Bucket als bereits erstellt ansehen (z. B. Hostiteasy); sonst prüfen/erstellen
    if (!process.env.MINIO_BUCKET) {
      try {
        const exists = await minioClient.bucketExists(bucketName);
        if (!exists) await minioClient.makeBucket(bucketName);
      } catch (e) {
        logger.warn('MinIO bucket check failed:', e);
      }
    }

    for (const [index, f] of (files as any[]).entries()) {
      const idStr = Date.now().toString() + Math.random().toString(36).slice(2);
      const originalName = (f as any).name || 'file';
      const customName = (nameList[index] ?? namesJson[index] ?? '').trim();
      const name = customName || originalName;
      const key = getProjectObjectKey(project, originalName);
      let fileBuffer: Buffer | null = null;
      try {
        // convert Blob/File to readable stream
        const buffer = await (f as any).arrayBuffer();
        fileBuffer = Buffer.from(buffer);
        const readable = new stream.Readable();
        readable._read = () => {}; // noop
        readable.push(fileBuffer);
        readable.push(null);
        await promisify(minioClient.putObject.bind(minioClient))(bucketName, key, readable, fileBuffer.byteLength);
      } catch (e) {
        logger.error('MinIO upload failed for', name, e);
      }
      const resolvedDescription =
        descriptionList[index] ??
        descriptionsJson[index] ??
        description ??
        '';
      // Best-effort: zusätzlich in den Projektordner in OneDrive spiegeln
      let oneDriveUrl: string | undefined
      if (fileBuffer) {
        try {
          const res = await syncProjectDocumentToOneDrive({
            project: { name: project.name, auftraggeber: project.auftraggeber, auftragsnummer: project.auftragsnummer },
            fileName: originalName,
            content: fileBuffer,
            contentType: (f as any).type,
          });
          if (res.uploaded) oneDriveUrl = res.webUrl;
        } catch { /* Sync ist optional */ }
      }

      const docMeta: Record<string, unknown> = { id: idStr, name, description: resolvedDescription, url: `minio://${bucketName}/${key}` };
      if (oneDriveUrl) docMeta.oneDriveUrl = oneDriveUrl;
      if (!project.dokumente['all']) project.dokumente['all'] = [];
      project.dokumente['all'].push(docMeta);
      uploaded.push(docMeta);
    }

    project.markModified('dokumente');
    await project.save();

    return NextResponse.json({ success: true, uploaded });
  } catch (e) {
    logger.error('Dokument-Upload fehlgeschlagen:', e);
    return NextResponse.json({ message: 'Upload fehlgeschlagen' }, { status: 500 });
  }
}


