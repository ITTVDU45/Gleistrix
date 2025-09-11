import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import { Project } from '@/lib/models/Project';
import { requireAuth } from '@/lib/security/requireAuth';
import { removeObject } from '@/lib/storage/minioClient';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string, docId: string }> }) {
  try {
    await dbConnect();
    const { id, docId } = await params;
    const auth = await requireAuth(request, ['user','admin','superadmin']);
    if (!auth.ok) return NextResponse.json({ message: auth.error }, { status: auth.status });

    const body = await request.json();
    const { description } = body;

    const project = await Project.findById(id);
    if (!project) return NextResponse.json({ message: 'Projekt nicht gefunden' }, { status: 404 });

    if (!project.dokumente || typeof project.dokumente !== 'object') (project as any).dokumente = {};
    const all = (project as any).dokumente['all'] || [];
    const idx = all.findIndex((d: any) => d.id === docId);
    if (idx === -1) return NextResponse.json({ message: 'Dokument nicht gefunden' }, { status: 404 });

    all[idx].description = description;
    (project as any).dokumente['all'] = all;
    (project as any).markModified('dokumente');
    await (project as any).save();

    return NextResponse.json({ success: true, document: all[idx] });
  } catch (e) {
    console.error('Dokument-Update fehlgeschlagen:', e);
    return NextResponse.json({ message: 'Update fehlgeschlagen' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string, docId: string }> }) {
  try {
    await dbConnect();
    const { id, docId } = await params;
    const auth = await requireAuth(request, ['user','admin','superadmin']);
    if (!auth.ok) return NextResponse.json({ message: auth.error }, { status: auth.status });

    const project = await Project.findById(id);
    if (!project) return NextResponse.json({ message: 'Projekt nicht gefunden' }, { status: 404 });

    if (!project.dokumente || typeof project.dokumente !== 'object') (project as any).dokumente = {};
    const all = (project as any).dokumente['all'] || [];
    const idx = all.findIndex((d: any) => d.id === docId);
    if (idx === -1) return NextResponse.json({ message: 'Dokument nicht gefunden' }, { status: 404 });

    const doc = all[idx];
    // remove from MinIO if possible
    try {
      if (typeof doc.url === 'string' && doc.url.startsWith('minio://')) {
        const bucketName = process.env.MINIO_BUCKET || 'project-documents';
        const key = doc.url.replace(`minio://${bucketName}/`, '');
        // use exported helper
        await removeObject(bucketName, key);
      }
    } catch (e) {
      console.warn('Failed to remove object from MinIO', e);
    }

    (project as any).dokumente['all'] = all.filter((d: any) => d.id !== docId);
    (project as any).markModified('dokumente');
    await (project as any).save();

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Dokument-Löschen fehlgeschlagen:', e);
    return NextResponse.json({ message: 'Löschen fehlgeschlagen' }, { status: 500 });
  }
}


