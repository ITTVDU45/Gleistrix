/**
 * Basis-URL für die Links in den Lager-Rückgabe-Erinnerungsmails.
 *
 * Diese Mails werden per Cron (`/api/cron/return-reminders`) ohne HTTP-Request
 * versendet, daher kann `getRequestBaseUrl()` hier nicht greifen – es gibt keinen
 * Host-Header. Wir bevorzugen deshalb Runtime-Variablen (`APP_DOMAIN`,
 * `NEXTAUTH_URL`): deren Wert wird zur Laufzeit gelesen, sodass ein Domainwechsel
 * ohne Rebuild wirksam wird.
 *
 * `NEXT_PUBLIC_BASE_URL` wird von Next.js zur *Build-Zeit* in den Bundle
 * eingebrannt; eine Änderung greift erst nach einem Redeploy. Die Variable bleibt
 * daher nur letzter Fallback, damit ein Domainwechsel nicht mehr an einem
 * vergessenen Rebuild scheitert.
 */
export function appBaseUrl(): string {
  return String(
    process.env.APP_DOMAIN
      || process.env.NEXTAUTH_URL
      || process.env.NEXT_PUBLIC_BASE_URL
      || ''
  ).replace(/\/+$/, '')
}
