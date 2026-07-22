import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import NotificationSettings from '@/lib/models/NotificationSettings';
import { DEFAULT_NOTIFICATION_DEFS } from '@/lib/notificationDefs';
import { RETURN_REMINDER_NOTIFICATION_KEY } from '@/lib/notificationDefs';
import { normalizeReturnReminderConfig } from '@/lib/lager/returnReminderSchedule';
import { formatNotificationRecipients } from '@/lib/notificationRecipients';
import { getToken } from 'next-auth/jwt';

// Baseline-Definitionen für Notification Keys
// Definitionen werden aus lib/notificationDefs importiert

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

  configByKey.set(
    RETURN_REMINDER_NOTIFICATION_KEY,
    normalizeReturnReminderConfig(configByKey.get(RETURN_REMINDER_NOTIFICATION_KEY))
  );

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
    logger.error('GET /api/notifications error', e);
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
    const sanitizedEnabledByKey = Object.fromEntries(
      Object.entries(DEFAULT_NOTIFICATION_DEFS).map(([key, definition]) => [
        key,
        typeof enabledByKey?.[key] === 'boolean' ? enabledByKey[key] : definition.defaultEnabled,
      ])
    );
    const sanitizedConfigByKey = Object.fromEntries(
      Object.entries(DEFAULT_NOTIFICATION_DEFS).map(([key, definition]) => {
        const rawConfig = configByKey?.[key] ?? definition.defaultConfig;
        if (key === RETURN_REMINDER_NOTIFICATION_KEY) {
          return [key, normalizeReturnReminderConfig(rawConfig)];
        }
        const defaultConfig = definition.defaultConfig as { to?: unknown };
        if (defaultConfig.to !== undefined) {
          const config = rawConfig && typeof rawConfig === 'object'
            ? rawConfig as Record<string, unknown>
            : {};
          return [key, {
            ...config,
            to: formatNotificationRecipients(config?.to, defaultConfig.to),
          }];
        }
        return [key, rawConfig];
      })
    );

    const doc = await NotificationSettings.findOneAndUpdate(
      { scope: 'global' },
      {
        $set: {
          enabledByKey: sanitizedEnabledByKey,
          configByKey: sanitizedConfigByKey,
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
    logger.error('PUT /api/notifications error', e);
    return NextResponse.json({ error: 'Fehler beim Speichern der Benachrichtigungseinstellungen' }, { status: 500 });
  }
}
