import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import { Project } from '@/lib/models/Project';
import { requireAuth } from '@/lib/security/requireAuth';
import minioClient from '@/lib/storage/minioClient';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await dbConnect();
    const { id } = await params;
    const auth = await requireAuth(request, ['user','admin','superadmin']);
    if (!auth.ok) return NextResponse.json({ message: auth.error }, { status: auth.status });

    const body = await request.json();
    // body.documents: [{ id, name, url, description }]
    const docs = body.documents || [];
    const project = await Project.findById(id);
    if (!project) return NextResponse.json({ message: 'Projekt nicht gefunden' }, { status: 404 });

    if (!project.dokumente || typeof project.dokumente !== 'object') (project as any).dokumente = {};
    if (!(project as any).dokumente['all']) (project as any).dokumente['all'] = [];

    const added: any[] = [];
    const bucketName = process.env.MINIO_BUCKET || 'project-documents';
    for (const d of docs) {
      const docId = Date.now().toString() + Math.random().toString(36).slice(2);
      // Try to stat object to get size and lastModified
      let size: number | null = null;
      let lastModified: string | null = null;
      try {
        // d.url expected like minio://bucket/key
        let key = '';
        if (typeof d.url === 'string' && d.url.startsWith('minio://')) {
          const parts = d.url.replace('minio://', '').split('/');
          parts.shift(); // remove bucket
          key = parts.join('/');
        } else if (d.key) {
          key = d.key;
        }
        if (key) {
          try {
            const stat = typeof (minioClient as any).statObjectAsync === 'function' ? await (minioClient as any).statObjectAsync(bucketName, key) : await new Promise<any>((resolve, reject) => minioClient.statObject(bucketName, key, (err: any, stat: any) => err ? reject(err) : resolve(stat)));
            size = stat.size || null;
            lastModified = stat.metaData && stat.metaData['last-modified'] ? stat.metaData['last-modified'] : (stat.lastModified ? stat.lastModified.toISOString() : null);
          } catch (inner) {
            // ignore stat errors
          }
        }
      } catch (e) {
        // ignore stat errors
      }
      const doc = { id: docId, name: d.name, url: d.url, description: d.description || '', size, lastModified };
      (project as any).dokumente['all'].push(doc);
      added.push(doc);
    }

    (project as any).markModified('dokumente');
    await (project as any).save();

    // Return the actual stored documents (with IDs)
    return NextResponse.json({ success: true, added });
  } catch (e) {
    console.error('Commit documents failed', e);
    return NextResponse.json({ message: 'Commit fehlgeschlagen' }, { status: 500 });
  }
}


