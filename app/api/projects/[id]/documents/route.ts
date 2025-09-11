import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import { Project } from '@/lib/models/Project';
import { requireAuth } from '@/lib/security/requireAuth';
import { getCurrentUser } from '@/lib/auth/getCurrentUser';
import minioClient, { getProjectObjectKey } from '@/lib/storage/minioClient';
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

    if (!project.dokumente || typeof project.dokumente !== 'object') (project as any).dokumente = {};

    const uploaded: any[] = [];
    // Stelle sicher, Bucket existiert
    const bucketName = process.env.MINIO_BUCKET || 'project-documents';
    try {
      const exists = await minioClient.bucketExists(bucketName);
      if (!exists) await minioClient.makeBucket(bucketName);
    } catch (e) {
      console.warn('MinIO bucket check failed:', e);
    }

    for (const f of files as any) {
      const idStr = Date.now().toString() + Math.random().toString(36).slice(2);
      const name = (f as any).name || 'file';
      const key = getProjectObjectKey(project, name);
      try {
        // convert Blob/File to readable stream
        const buffer = await (f as any).arrayBuffer();
        const readable = new stream.Readable();
        readable._read = () => {}; // noop
        readable.push(Buffer.from(buffer));
        readable.push(null);
        await promisify(minioClient.putObject.bind(minioClient))(bucketName, key, readable, buffer.byteLength);
      } catch (e) {
        console.error('MinIO upload failed for', name, e);
      }
      const docMeta = { id: idStr, name, description: description || '', url: `minio://${bucketName}/${key}` };
      if (!(project as any).dokumente['all']) (project as any).dokumente['all'] = [];
      (project as any).dokumente['all'].push(docMeta);
      uploaded.push(docMeta);
    }

    (project as any).markModified('dokumente');
    await (project as any).save();

    return NextResponse.json({ success: true, uploaded });
  } catch (e) {
    console.error('Dokument-Upload fehlgeschlagen:', e);
    return NextResponse.json({ message: 'Upload fehlgeschlagen' }, { status: 500 });
  }
}


