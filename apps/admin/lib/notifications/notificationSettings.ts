import NotificationSettings from '@/lib/models/NotificationSettings';
import { DEFAULT_NOTIFICATION_DEFS } from '@/lib/notificationDefs';
import { formatNotificationRecipients } from '@/lib/notificationRecipients';

type NotificationDefinition = (typeof DEFAULT_NOTIFICATION_DEFS)[keyof typeof DEFAULT_NOTIFICATION_DEFS];

function mergeMapValues<T>(target: Map<string, T>, source: unknown) {
  if (!source) return;
  if (source instanceof Map || typeof (source as { entries?: unknown }).entries === 'function') {
    for (const [key, value] of (source as Map<string, T>).entries()) target.set(key, value);
    return;
  }
  if (typeof source === 'object') {
    for (const [key, value] of Object.entries(source as Record<string, T>)) target.set(key, value);
  }
}

export function mergeNotificationSettings(doc?: {
  enabledByKey?: unknown;
  configByKey?: unknown;
} | null) {
  const enabledByKey = new Map<string, boolean>(
    Object.entries(DEFAULT_NOTIFICATION_DEFS).map(([key, definition]) => [key, definition.defaultEnabled])
  );
  const configByKey = new Map<string, unknown>(
    Object.entries(DEFAULT_NOTIFICATION_DEFS).map(([key, definition]) => [key, definition.defaultConfig])
  );

  mergeMapValues(enabledByKey, doc?.enabledByKey);
  mergeMapValues(configByKey, doc?.configByKey);
  return { enabledByKey, configByKey };
}

export async function getNotificationRule(key: string): Promise<{
  key: string;
  enabled: boolean;
  to: string;
  config: Record<string, unknown>;
  definition?: NotificationDefinition;
}> {
  const settings = await NotificationSettings.findOne({ scope: 'global' });
  const merged = mergeNotificationSettings(settings);
  const definition = DEFAULT_NOTIFICATION_DEFS[key as keyof typeof DEFAULT_NOTIFICATION_DEFS] as NotificationDefinition | undefined;
  const rawConfig = merged.configByKey.get(key);
  const config = rawConfig && typeof rawConfig === 'object'
    ? { ...(rawConfig as Record<string, unknown>) }
    : {};
  const defaultConfig = definition?.defaultConfig as { to?: unknown } | undefined;

  return {
    key,
    enabled: Boolean(merged.enabledByKey.get(key)),
    to: formatNotificationRecipients(config.to, defaultConfig?.to),
    config,
    definition,
  };
}
