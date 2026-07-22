const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Akzeptiert einzelne oder mehrere Empfänger (Komma, Semikolon oder
 * Zeilenumbruch), entfernt Duplikate und verwirft ungültige Adressen.
 */
export function parseNotificationRecipients(value: unknown): string[] {
  const rawValues = Array.isArray(value) ? value : [value];
  const recipients: string[] = [];
  const seen = new Set<string>();

  for (const rawValue of rawValues) {
    if (typeof rawValue !== 'string') continue;
    for (const candidate of rawValue.split(/[,;\n]+/)) {
      const email = candidate.trim();
      const normalized = email.toLowerCase();
      if (!EMAIL_PATTERN.test(email) || seen.has(normalized)) continue;
      seen.add(normalized);
      recipients.push(email);
    }
  }

  return recipients;
}

export function resolveNotificationRecipients(value: unknown, fallback?: unknown): string[] {
  const configured = parseNotificationRecipients(value);
  return configured.length > 0 ? configured : parseNotificationRecipients(fallback);
}

export function formatNotificationRecipients(value: unknown, fallback?: unknown): string {
  return resolveNotificationRecipients(value, fallback).join(', ');
}
