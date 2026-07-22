export const RETURN_REMINDER_NOTIFICATION_KEY = 'Anstehende Lager-Rückgabe – Erinnerung an Ausgeber';
export const PROJECT_COMPLETED_NOTIFICATION_KEY = 'Projekt auf „abgeschlossen“ gesetzt – E-Mail an Buchhaltung';
export const PROJECT_FINISHED_NOTIFICATION_KEY = 'Projekt auf „fertiggestellt“ gesetzt – E-Mail an Buchhaltung';
export const PROJECT_PARTIALLY_BILLED_NOTIFICATION_KEY = 'Projekt teilweise abgerechnet – E-Mail an Buchhaltung';
export const PROJECT_BILLED_NOTIFICATION_KEY = 'Projekt auf „geleistet“ gesetzt – E-Mail an Buchhaltung';
export const BILLING_CREATED_NOTIFICATION_KEY = 'Abrechnung erstellt – E-Mail an Buchhaltung';

export const PROJECT_STATUS_NOTIFICATION_KEYS = {
  abgeschlossen: PROJECT_COMPLETED_NOTIFICATION_KEY,
  fertiggestellt: PROJECT_FINISHED_NOTIFICATION_KEY,
  teilweise_abgerechnet: PROJECT_PARTIALLY_BILLED_NOTIFICATION_KEY,
  geleistet: PROJECT_BILLED_NOTIFICATION_KEY,
} as const;

export type NotifiableProjectStatus = keyof typeof PROJECT_STATUS_NOTIFICATION_KEYS;

export function notificationKeyForProjectStatus(status: unknown): string | null {
  if (typeof status !== 'string') return null;
  return PROJECT_STATUS_NOTIFICATION_KEYS[status as NotifiableProjectStatus] ?? null;
}

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
  [PROJECT_COMPLETED_NOTIFICATION_KEY]: {
    key: PROJECT_COMPLETED_NOTIFICATION_KEY,
    label: 'E-Mail an Buchhaltung bei Status "abgeschlossen"',
    description:
      'Wenn ein Projekt auf "abgeschlossen" gesetzt wird, sende automatisch eine E-Mail an die hinterlegten Empfänger.',
    defaultEnabled: false,
    defaultConfig: { to: 'Buchhaltung@mulheimerwachdienst.de' },
  },
  [PROJECT_FINISHED_NOTIFICATION_KEY]: {
    key: PROJECT_FINISHED_NOTIFICATION_KEY,
    label: 'E-Mail an Buchhaltung bei Status "fertiggestellt"',
    description:
      'Wenn ein Projekt auf "fertiggestellt" gesetzt wird, sende automatisch eine E-Mail mit den PDF-Unterlagen an die Buchhaltung.',
    defaultEnabled: true,
    defaultConfig: { to: 'Buchhaltung@mulheimerwachdienst.de' },
  },
  [PROJECT_PARTIALLY_BILLED_NOTIFICATION_KEY]: {
    key: PROJECT_PARTIALLY_BILLED_NOTIFICATION_KEY,
    label: 'E-Mail an Buchhaltung bei Teilabrechnung',
    description:
      'Wenn sich ein Projekt nach einer Abrechnung im Status "teilweise abgerechnet" befindet, sende automatisch eine E-Mail an die hinterlegten Empfänger.',
    defaultEnabled: false,
    defaultConfig: { to: 'Buchhaltung@mulheimerwachdienst.de' },
  },
  // Der Schlüssel existiert bereits in älteren Installationen. Er wird jetzt
  // für den tatsächlichen Systemstatus "geleistet" (vollständig abgerechnet)
  // weiterverwendet, sodass bestehende Einstellungen erhalten bleiben.
  [PROJECT_BILLED_NOTIFICATION_KEY]: {
    key: PROJECT_BILLED_NOTIFICATION_KEY,
    label: 'E-Mail an Buchhaltung bei vollständiger Abrechnung',
    description:
      'Wenn ein Projekt vollständig abgerechnet wurde und den Status "geleistet" erhält, sende automatisch eine E-Mail an die hinterlegten Empfänger.',
    defaultEnabled: false,
    defaultConfig: { to: 'Buchhaltung@mulheimerwachdienst.de' },
  },
  [BILLING_CREATED_NOTIFICATION_KEY]: {
    key: BILLING_CREATED_NOTIFICATION_KEY,
    label: 'E-Mail an Buchhaltung bei erstellter Abrechnung',
    description:
      'Wenn eine Abrechnung erstellt wird, sende automatisch eine E-Mail mit der Abrechnung an die Buchhaltung.',
    defaultEnabled: false,
    defaultConfig: { to: 'Buchhaltung@mulheimerwachdienst.de' },
  },
} as const;

export type NotificationDefs = typeof DEFAULT_NOTIFICATION_DEFS;
