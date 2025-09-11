import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import { Project } from '@/lib/models/Project';
import { requireAuth } from '@/lib/security/requireAuth';
import minioClient, { getProjectObjectKey } from '@/lib/storage/minioClient';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await dbConnect();
    const { id } = await params;
    const auth = await requireAuth(request, ['user','admin','superadmin']);
    if (!auth.ok) return NextResponse.json({ message: auth.error }, { status: auth.status });

    const body = await request.json();
    // body.files: [{ name, contentType }]
    const files: { name: string; contentType?: string }[] = body.files || [];
    if (!files || files.length === 0) return NextResponse.json({ message: 'Keine Dateien angegeben' }, { status: 400 });

    const project = await Project.findById(id);
    if (!project) return NextResponse.json({ message: 'Projekt nicht gefunden' }, { status: 404 });

    const bucketName = process.env.MINIO_BUCKET || 'project-documents';
    try {
      // prefer promise helpers if available
      const exists = typeof (minioClient as any).bucketExistsAsync === 'function' ? await (minioClient as any).bucketExistsAsync(bucketName) : await minioClient.bucketExists(bucketName);
      if (!exists) {
        if (typeof (minioClient as any).makeBucketAsync === 'function') await (minioClient as any).makeBucketAsync(bucketName);
        else await minioClient.makeBucket(bucketName);
      }
    } catch (e) {
      console.warn('MinIO bucket check failed:', e);
    }

    const results: any[] = [];
    for (const f of files) {
      const key = getProjectObjectKey(project, f.name);
      // expires seconds
      const expires = 60 * 10;
      // use promise helper when available to avoid callback result confusion
      const presigned = typeof (minioClient as any).presignedPutObjectAsync === 'function'
        ? await (minioClient as any).presignedPutObjectAsync(bucketName, key, expires)
        : await new Promise<string>((resolve, reject) => minioClient.presignedPutObject(bucketName, key, expires, (err: any, url: string) => err ? reject(err) : resolve(url)));
      results.push({ name: f.name, key, url: `minio://${bucketName}/${key}`, presignedUrl: presigned, contentType: f.contentType || 'application/octet-stream' });
    }

    return NextResponse.json({ success: true, uploads: results });
  } catch (e) {
    console.error('Presign upload failed', e);
    return NextResponse.json({ message: 'Presign fehlgeschlagen' }, { status: 500 });
  }
}


