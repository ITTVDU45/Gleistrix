import { describe, expect, test } from 'vitest';
import {
  PROJECT_BILLED_NOTIFICATION_KEY,
  PROJECT_COMPLETED_NOTIFICATION_KEY,
  PROJECT_FINISHED_NOTIFICATION_KEY,
  PROJECT_PARTIALLY_BILLED_NOTIFICATION_KEY,
  notificationKeyForProjectStatus,
} from './notificationDefs';
import { formatNotificationRecipients, parseNotificationRecipients } from './notificationRecipients';

describe('Projekt-Benachrichtigungen', () => {
  test.each([
    ['abgeschlossen', PROJECT_COMPLETED_NOTIFICATION_KEY],
    ['fertiggestellt', PROJECT_FINISHED_NOTIFICATION_KEY],
    ['teilweise_abgerechnet', PROJECT_PARTIALLY_BILLED_NOTIFICATION_KEY],
    ['geleistet', PROJECT_BILLED_NOTIFICATION_KEY],
  ])('ordnet den Status %s dem richtigen Schlüssel zu', (status, key) => {
    expect(notificationKeyForProjectStatus(status)).toBe(key);
  });

  test.each(['aktiv', 'kein Status', '', undefined])('überspringt Status ohne Versandregel: %s', (status) => {
    expect(notificationKeyForProjectStatus(status)).toBeNull();
  });
});

describe('Benachrichtigungs-Empfänger', () => {
  test('akzeptiert mehrere Trennzeichen und entfernt Duplikate', () => {
    expect(parseNotificationRecipients('A@example.de; b@example.de, a@example.de\nc@example.de')).toEqual([
      'A@example.de',
      'b@example.de',
      'c@example.de',
    ]);
  });

  test('verwirft ungültige Adressen und verwendet bei Bedarf den Fallback', () => {
    expect(formatNotificationRecipients('keine-adresse', 'fallback@example.de')).toBe('fallback@example.de');
  });
});
