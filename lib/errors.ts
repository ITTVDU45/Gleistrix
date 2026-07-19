/**
 * Sichere Extraktion von Fehlerinformationen aus `unknown`-Fehlern
 * (in catch-Blöcken ist die gefangene Variable `unknown`).
 */

export function getErrorMessage(error: unknown, fallback = 'Unbekannter Fehler'): string {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'string' && error) return error
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message
    if (message) return String(message)
  }
  return fallback
}

/** HTTP-ähnliche Fehlerform (z. B. aus API-Clients) minimal typisiert. */
export interface HttpLikeError {
  code?: string | number
  response?: { status?: number; data?: { error?: string; message?: string } }
  message?: string
}

export function asHttpLikeError(error: unknown): HttpLikeError {
  return (error ?? {}) as HttpLikeError
}
