import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import dbConnect from '@/lib/dbConnect';
import { logger } from '@/lib/logger';
import { Project } from '@/lib/models/Project';
import { requireAuth } from '@/lib/security/requireAuth';
import { sendProjectStatusNotification } from '@/lib/notifications/projectStatusNotification';

export const runtime = 'nodejs';

const projectStatusSchema = z.object({
  status: z.enum([
    'aktiv',
    'abgeschlossen',
    'fertiggestellt',
    'geleistet',
    'teilweise_abgerechnet',
    'kein Status',
  ]),
});

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const csrf = req.headers.get('x-csrf-intent');
    if (process.env.NODE_ENV === 'production' && csrf !== 'projects:update-status') {
      return NextResponse.json({ error: 'Ungültige Anforderung' }, { status: 400 });
    }
    const auth = await requireAuth(req, ['user', 'admin', 'superadmin']);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const parsed = projectStatusSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validierungsfehler', issues: parsed.error.flatten() }, { status: 400 });
    }

    await dbConnect();
    const { id } = await params;
    const previousProject = await Project.findById(id).select({ status: 1 }).lean();
    if (!previousProject) {
      return NextResponse.json({ error: 'Projekt nicht gefunden' }, { status: 404 });
    }

    const project = await Project.findByIdAndUpdate(
      id,
      { status: parsed.data.status },
      { new: true, runValidators: true }
    );
    if (!project) {
      return NextResponse.json({ error: 'Projekt nicht gefunden' }, { status: 404 });
    }

    await sendProjectStatusNotification({
      project,
      previousStatus: previousProject.status,
      performedBy: String(auth.token?.name || auth.token?.email || 'Unbekannt'),
    });

    return NextResponse.json({ success: true, project });
  } catch (error) {
    logger.error('PUT /api/projects/[id]/status error', error);
    return NextResponse.json({ error: 'Fehler beim Aktualisieren des Status' }, { status: 500 });
  }
}
