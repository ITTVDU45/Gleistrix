import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '../../../lib/dbConnect';
import NotificationSettings from '../../../lib/models/NotificationSettings';
import { getToken } from 'next-auth/jwt';

// Baseline-Definitionen für Notification Keys
const DEFAULT_NOTIFICATION_DEFS = {
  'Projekt auf „geleistet“ gesetzt – E-Mail an Buchhaltung': {
    key: 'Projekt auf „geleistet“ gesetzt – E-Mail an Buchhaltung',
    label: 'E-Mail an Buchhaltung bei Status "geleistet"',
    description:
      'Wenn ein Projekt auf "geleistet" gesetzt wird, sende automatisch eine E-Mail mit den PDF-Unterlagen an die Buchhaltung.',
    defaultEnabled: true,
    defaultConfig: { to: 'Buchhaltung@mulheimerwachdienst.de' },
  },
} as const;

function buildMergedSettings(doc?: any) {
  const enabledByKey = new Map<string, boolean>(Object.entries(DEFAULT_NOTIFICATION_DEFS).map(([k, def]) => [k, def.defaultEnabled]));
  const configByKey = new Map<string, any>(Object.entries(DEFAULT_NOTIFICATION_DEFS).map(([k, def]) => [k, def.defaultConfig]));

  if (doc) {
    if (doc.enabledByKey) {
      for (const [k, v] of doc.enabledByKey.entries()) enabledByKey.set(k, v);
    }
    if (doc.configByKey) {
      for (const [k, v] of doc.configByKey.entries()) configByKey.set(k, v);
    }
  }

  return { enabledByKey, configByKey };
}

export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    const doc = await NotificationSettings.findOne({ scope: 'global' });
    const merged = buildMergedSettings(doc);

    return NextResponse.json({
      definitions: DEFAULT_NOTIFICATION_DEFS,
      enabledByKey: Object.fromEntries(merged.enabledByKey),
      configByKey: Object.fromEntries(merged.configByKey),
    });
  } catch (e) {
    console.error('GET /api/notifications error', e);
    return NextResponse.json({ error: 'Fehler beim Laden der Benachrichtigungseinstellungen' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    // optional: nur Admins dürfen globale Defaults ändern
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token || (token.role !== 'admin' && token.role !== 'superadmin')) {
      return NextResponse.json({ error: 'Nicht berechtigt' }, { status: 403 });
    }

    await dbConnect();
    const body = await req.json();
    const { enabledByKey = {}, configByKey = {} } = body || {};

    const doc = await NotificationSettings.findOneAndUpdate(
      { scope: 'global' },
      {
        $set: {
          enabledByKey,
          configByKey,
        },
      },
      { upsert: true, new: true }
    );

    const merged = buildMergedSettings(doc);
    return NextResponse.json({
      definitions: DEFAULT_NOTIFICATION_DEFS,
      enabledByKey: Object.fromEntries(merged.enabledByKey),
      configByKey: Object.fromEntries(merged.configByKey),
    });
  } catch (e) {
    console.error('PUT /api/notifications error', e);
    return NextResponse.json({ error: 'Fehler beim Speichern der Benachrichtigungseinstellungen' }, { status: 500 });
  }
}


