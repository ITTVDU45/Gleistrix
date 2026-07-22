import { describe, expect, test } from 'vitest';
import {
  PROJECT_COMPLETED_NOTIFICATION_KEY,
  PROJECT_FINISHED_NOTIFICATION_KEY,
} from '@/lib/notificationDefs';
import { mergeNotificationSettings } from './notificationSettings';

describe('mergeNotificationSettings', () => {
  test('liefert Definitionen als Defaults, wenn noch keine Einstellungen gespeichert sind', () => {
    const merged = mergeNotificationSettings();

    expect(merged.enabledByKey.get(PROJECT_FINISHED_NOTIFICATION_KEY)).toBe(true);
    expect(merged.enabledByKey.get(PROJECT_COMPLETED_NOTIFICATION_KEY)).toBe(false);
  });

  test('übernimmt gespeicherte Map- und Objektwerte', () => {
    const merged = mergeNotificationSettings({
      enabledByKey: new Map([[PROJECT_COMPLETED_NOTIFICATION_KEY, true]]),
      configByKey: {
        [PROJECT_COMPLETED_NOTIFICATION_KEY]: { to: 'team@example.de' },
      },
    });

    expect(merged.enabledByKey.get(PROJECT_COMPLETED_NOTIFICATION_KEY)).toBe(true);
    expect(merged.configByKey.get(PROJECT_COMPLETED_NOTIFICATION_KEY)).toEqual({ to: 'team@example.de' });
  });
});
