import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '../../../../lib/dbConnect';
import NotificationLog from '../../../../lib/models/NotificationLog';
import { getToken } from 'next-auth/jwt';

export async function GET(req: NextRequest) {
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 });

    await dbConnect();

    const logs = await NotificationLog.find({}).sort({ createdAt: -1 }).limit(100).lean();
    const rows = logs.map(l => ({
      id: String(l._id),
      timestamp: l.createdAt,
      key: l.key,
      projectName: l.projectName || '-',
      to: l.to,
      subject: l.subject,
      success: l.success,
      attachmentsCount: l.attachmentsCount || 0,
      errorMessage: l.errorMessage || null,
      performedBy: (l.meta && (l.meta as any).performedBy) || null,
    }));
    return NextResponse.json({ logs: rows });
  } catch (e) {
    console.error('GET /api/notifications/logs error', e);
    return NextResponse.json({ error: 'Fehler beim Laden der Logs' }, { status: 500 });
  }
}


