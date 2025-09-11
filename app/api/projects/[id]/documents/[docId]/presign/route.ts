import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import { Project } from '@/lib/models/Project';
import { requireAuth } from '@/lib/security/requireAuth';
import minioClient from '@/lib/storage/minioClient';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string, docId: string }> }) {
  try {
    await dbConnect();
    const { id, docId } = await params;
    const auth = await requireAuth(request, ['user','admin','superadmin']);
    if (!auth.ok) return NextResponse.json({ message: auth.error }, { status: auth.status });

    const project = await Project.findById(id);
    if (!project) return NextResponse.json({ message: 'Projekt nicht gefunden' }, { status: 404 });

    const all = (project as any).dokumente?.all || [];
    const doc = all.find((d: any) => d.id === docId);
    if (!doc) return NextResponse.json({ message: 'Dokument nicht gefunden' }, { status: 404 });

    const bucketName = process.env.MINIO_BUCKET || 'project-documents';
    // doc.url stored as minio://bucket/key
    let key = '';
    if (doc.url && typeof doc.url === 'string' && doc.url.startsWith(`minio://${bucketName}/`)) {
      key = doc.url.replace(`minio://${bucketName}/`, '');
    } else if (doc.url && typeof doc.url === 'string' && doc.url.startsWith('minio://')) {
      key = doc.url.replace('minio://', '');
    } else {
      // fallback: cannot determine key
      return NextResponse.json({ message: 'Objekt-Pfad nicht bekannt' }, { status: 400 });
    }

    const expires = 60 * 5; // 5 Minuten
    // prefer promise helper if available
    const presigned = typeof (minioClient as any).presignedGetObjectAsync === 'function'
      ? await (minioClient as any).presignedGetObjectAsync(bucketName, key, expires)
      : await new Promise<string>((resolve, reject) => minioClient.presignedGetObject(bucketName, key, expires, (err: any, url: string) => err ? reject(err) : resolve(url)));
    return NextResponse.json({ url: presigned });
  } catch (e) {
    console.error('Presign failed', e);
    return NextResponse.json({ message: 'Presign fehlgeschlagen' }, { status: 500 });
  }
}


