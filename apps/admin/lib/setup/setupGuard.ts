import dbConnect from '@/lib/dbConnect'
import User from '@/lib/models/User'

/**
 * Schützt die Setup-Routen (`/api/setup/*`).
 *
 * Setup-Endpunkte (Superadmin anlegen, Willkommens-Mail auslösen) sind reine
 * Erst-Einrichtungswerkzeuge und dürfen auf einem eingerichteten System nicht
 * offen erreichbar sein – `create-superadmin` würde sonst eine öffentliche
 * Privilege-Escalation ermöglichen (jeder könnte sich einen Superadmin anlegen).
 *
 * Freigabe nur, wenn:
 *   1. `SETUP_ENABLED=true` (bewusster Escape-Hatch), ODER
 *   2. die Installation frisch ist (0 Benutzer in der DB).
 *
 * Hinweis: Ein reiner "existiert ein Superadmin?"-Check reicht NICHT, weil der
 * Superadmin über ENV (`SUPERADMIN_EMAIL`/`SUPERADMIN_PASSWORD`) laufen kann und
 * dann gar kein DB-Dokument existiert. Die Benutzeranzahl ist das robustere
 * Signal für "System bereits eingerichtet".
 */
export type SetupGuardResult =
  | { allowed: true }
  | { allowed: false; status: number; error: string }

export function isSetupExplicitlyEnabled(): boolean {
  return process.env.SETUP_ENABLED === 'true'
}

export async function assertSetupAllowed(): Promise<SetupGuardResult> {
  if (isSetupExplicitlyEnabled()) {
    return { allowed: true }
  }

  await dbConnect()
  const userCount = await User.estimatedDocumentCount()
  if (userCount > 0) {
    return {
      allowed: false,
      status: 403,
      error: 'Setup ist abgeschlossen. Setze SETUP_ENABLED=true, um Setup-Routen erneut freizugeben.',
    }
  }

  return { allowed: true }
}
