export const DEFAULT_NOTIFICATION_DEFS = {
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
} as const;

export type NotificationDefs = typeof DEFAULT_NOTIFICATION_DEFS;

