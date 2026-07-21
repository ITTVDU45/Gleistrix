export const RETURN_REMINDER_NOTIFICATION_KEY = 'Anstehende Lager-Rückgabe – Erinnerung an Ausgeber';

export type ReturnReminderUnit = 'days' | 'weeks' | 'months';

export interface ReturnReminderInterval {
  id: string;
  value: number;
  unit: ReturnReminderUnit;
  enabled: boolean;
}

export interface ReturnReminderConfig {
  intervals: ReturnReminderInterval[];
}

export const DEFAULT_RETURN_REMINDER_CONFIG: ReturnReminderConfig = {
  intervals: [
    { id: 'one-month', value: 1, unit: 'months', enabled: true },
    { id: 'two-weeks', value: 2, unit: 'weeks', enabled: true },
    { id: 'one-week', value: 1, unit: 'weeks', enabled: true },
    { id: 'five-days', value: 5, unit: 'days', enabled: true },
    { id: 'two-days', value: 2, unit: 'days', enabled: true },
    { id: 'tomorrow', value: 1, unit: 'days', enabled: true },
    { id: 'today', value: 0, unit: 'days', enabled: true },
  ],
};

export const DEFAULT_NOTIFICATION_DEFS = {
  [RETURN_REMINDER_NOTIFICATION_KEY]: {
    key: RETURN_REMINDER_NOTIFICATION_KEY,
    label: 'Rückgabe-Erinnerungen für Lagermitarbeiter',
    description:
      'Sendet eine E-Mail und eine interne Benachrichtigung an den Benutzer, der die Ausgabe gebucht hat.',
    kind: 'return-reminder-schedule',
    defaultEnabled: true,
    defaultConfig: DEFAULT_RETURN_REMINDER_CONFIG,
  },
  'Projekt auf „fertiggestellt“ gesetzt – E-Mail an Buchhaltung': {
    key: 'Projekt auf „fertiggestellt“ gesetzt – E-Mail an Buchhaltung',
    label: 'E-Mail an Buchhaltung bei Status "fertiggestellt"',
    description:
      'Wenn ein Projekt auf "fertiggestellt" gesetzt wird, sende automatisch eine E-Mail mit den PDF-Unterlagen an die Buchhaltung.',
    defaultEnabled: true,
    defaultConfig: { to: 'Buchhaltung@mulheimerwachdienst.de' },
  },
  // Abwärtskompatibler Alt-Schlüssel, falls Konfigurationen bereits existieren
  'Projekt auf „geleistet“ gesetzt – E-Mail an Buchhaltung': {
    key: 'Projekt auf „geleistet“ gesetzt – E-Mail an Buchhaltung',
    label: 'E-Mail an Buchhaltung bei Status "geleistet"',
    description:
      'Alt: Wenn ein Projekt auf "geleistet" gesetzt wird, sende automatisch eine E-Mail mit den PDF-Unterlagen an die Buchhaltung.',
    defaultEnabled: false,
    defaultConfig: { to: 'Buchhaltung@mulheimerwachdienst.de' },
  },
  'Abrechnung erstellt – E-Mail an Buchhaltung': {
    key: 'Abrechnung erstellt – E-Mail an Buchhaltung',
    label: 'E-Mail an Buchhaltung bei erstellter Abrechnung',
    description:
      'Wenn eine Abrechnung erstellt wird, sende automatisch eine E-Mail mit der Abrechnung an die Buchhaltung.',
    defaultEnabled: false,
    defaultConfig: { to: 'Buchhaltung@mulheimerwachdienst.de' },
  },
} as const;

export type NotificationDefs = typeof DEFAULT_NOTIFICATION_DEFS;
