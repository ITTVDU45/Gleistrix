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

    // sanity checks for MinIO config: accept either MINIO_ACCESS_KEY/SECRET or MINIO_ROOT_USER/ROOT_PASSWORD
    const hasAccessPair = !!(process.env.MINIO_ACCESS_KEY && process.env.MINIO_SECRET_KEY);
    const hasRootPair = !!(process.env.MINIO_ROOT_USER && process.env.MINIO_ROOT_PASSWORD);
    if (!hasAccessPair && !hasRootPair) {
      console.error('MinIO credentials missing: neither MINIO_ACCESS_KEY/MINIO_SECRET_KEY nor MINIO_ROOT_USER/MINIO_ROOT_PASSWORD are set');
      return NextResponse.json({ message: 'Presign fehlgeschlagen', error: 'MinIO-Konfiguration fehlt (MINIO_ACCESS_KEY / MINIO_SECRET_KEY or MINIO_ROOT_USER / MINIO_ROOT_PASSWORD)' }, { status: 500 });
    }
    console.info('Using MinIO credentials from', hasAccessPair ? 'MINIO_ACCESS_KEY/MINIO_SECRET_KEY' : 'MINIO_ROOT_USER/MINIO_ROOT_PASSWORD');

    const bucketName = process.env.MINIO_BUCKET || 'project-documents';
    // Bei gesetztem MINIO_BUCKET Bucket als bereits erstellt ansehen (z. B. Hostiteasy); sonst prüfen/erstellen
    if (!process.env.MINIO_BUCKET) {
      try {
        const exists = typeof (minioClient as any).bucketExistsAsync === 'function' ? await (minioClient as any).bucketExistsAsync(bucketName) : await minioClient.bucketExists(bucketName);
        if (!exists) {
          if (typeof (minioClient as any).makeBucketAsync === 'function') await (minioClient as any).makeBucketAsync(bucketName);
          else await minioClient.makeBucket(bucketName);
        }
      } catch (e) {
        console.warn('MinIO bucket check failed:', e);
      }
    }

    const results: any[] = [];
    for (const f of files) {
      try {
        const key = getProjectObjectKey(project, f.name);
        // expires seconds
        const expires = 60 * 10;
        // use promise helper when available to avoid callback result confusion
        let presigned = typeof (minioClient as any).presignedPutObjectAsync === 'function'
          ? await (minioClient as any).presignedPutObjectAsync(bucketName, key, expires)
          : await new Promise<string>((resolve, reject) => minioClient.presignedPutObject(bucketName, key, expires, (err: any, url: string) => err ? reject(err) : resolve(url)));
        // Wenn MINIO_PUBLIC_URL gesetzt ist: Presigned-URL für den Browser auf den öffentlichen Host umbiegen,
        // damit Clients (z. B. Nutzer außerhalb des internen Netzes) den Speicher erreichen können.
        const publicUrl = process.env.MINIO_PUBLIC_URL;
        if (publicUrl && presigned) {
          try {
            const presignedUrlObj = new URL(presigned);
            const publicUrlObj = new URL(publicUrl);
            presignedUrlObj.protocol = publicUrlObj.protocol;
            presignedUrlObj.host = publicUrlObj.host;
            presigned = presignedUrlObj.toString();
          } catch (urlErr) {
            console.warn('MINIO_PUBLIC_URL replace failed, using original presigned URL', urlErr);
          }
        }
        results.push({ name: f.name, key, url: `minio://${bucketName}/${key}`, presignedUrl: presigned, contentType: f.contentType || 'application/octet-stream' });
      } catch (fileErr) {
        console.error('Presign for file failed', { file: f, error: fileErr });
        // include per-file error info to help debugging
        return NextResponse.json({ message: 'Presign fehlgeschlagen', error: String(fileErr instanceof Error ? fileErr.message : fileErr) }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, uploads: results });
  } catch (e) {
    console.error('Presign upload failed', e);
    return NextResponse.json({ message: 'Presign fehlgeschlagen' }, { status: 500 });
  }
}


