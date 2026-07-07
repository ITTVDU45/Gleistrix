const AUTHORITY_BASE = 'https://login.microsoftonline.com'
const GRAPH_BASE = 'https://graph.microsoft.com/v1.0'

interface OAuthConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
  tenantMode: string
}

interface TokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
  token_type: string
  scope: string
}

export interface TokenSet {
  accessToken: string
  refreshToken: string
  expiresAt: number
  scope: string
}

const MODULE_SCOPES: Record<string, string[]> = {
  outlook: ['Mail.Read', 'Mail.Send', 'Mail.ReadWrite'],
  calendar: ['Calendars.ReadWrite'],
  onedrive: ['Files.ReadWrite.All'],
  sharepoint: ['Sites.ReadWrite.All'],
  teams: ['ChannelMessage.Send', 'Channel.ReadBasic.All', 'Team.ReadBasic.All'],
}

export function buildScopes(enabledModules: string[]): string {
  const scopes = new Set(['User.Read', 'offline_access'])
  for (const mod of enabledModules) {
    const modScopes = MODULE_SCOPES[mod]
    if (modScopes) {
      for (const s of modScopes) scopes.add(s)
    }
  }
  return Array.from(scopes).join(' ')
}

function getTenantPath(tenantMode: string): string {
  switch (tenantMode) {
    case 'consumers': return 'consumers'
    case 'common': return 'common'
    default: return 'organizations'
  }
}

export function buildAuthorizationUrl(config: OAuthConfig, enabledModules: string[], state: string): string {
  const tenant = getTenantPath(config.tenantMode)
  const scopes = buildScopes(enabledModules)

  const params = new URLSearchParams({
    client_id: config.clientId.trim(),
    response_type: 'code',
    redirect_uri: config.redirectUri.trim(),
    scope: scopes,
    response_mode: 'query',
    state,
    prompt: 'consent',
  })

  return `${AUTHORITY_BASE}/${tenant}/oauth2/v2.0/authorize?${params.toString()}`
}

export async function exchangeCodeForTokens(
  config: OAuthConfig,
  code: string,
  enabledModules: string[]
): Promise<TokenSet> {
  const tenant = getTenantPath(config.tenantMode)
  const scopes = buildScopes(enabledModules)

  const body = new URLSearchParams({
    client_id: config.clientId.trim(),
    client_secret: config.clientSecret.trim(),
    code,
    redirect_uri: config.redirectUri.trim(),
    grant_type: 'authorization_code',
    scope: scopes,
  })

  const res = await fetch(`${AUTHORITY_BASE}/${tenant}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!res.ok) {
    throw new Error(`Token-Austausch fehlgeschlagen (${res.status}): ${await describeOAuthError(res)}`)
  }

  const data = (await res.json()) as TokenResponse

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || '',
    expiresAt: Date.now() + data.expires_in * 1000,
    scope: data.scope,
  }
}

/**
 * Extrahiert die aussagekräftige Fehlerbeschreibung (inkl. AADSTS-Code) aus einer
 * fehlgeschlagenen OAuth-Antwort von Microsoft; fällt auf den Rohtext zurück.
 */
async function describeOAuthError(res: Response): Promise<string> {
  const raw = await res.text().catch(() => '')
  try {
    const json = JSON.parse(raw) as { error?: string; error_description?: string }
    if (json.error_description) return json.error_description.split('\n')[0]
    if (json.error) return json.error
  } catch {
    /* kein JSON – Rohtext verwenden */
  }
  return raw.slice(0, 300) || 'Unbekannter Fehler'
}

export async function refreshAccessToken(config: OAuthConfig, refreshToken: string): Promise<TokenSet> {
  const tenant = getTenantPath(config.tenantMode)

  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  })

  const res = await fetch(`${AUTHORITY_BASE}/${tenant}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!res.ok) {
    throw new Error(`Token-Refresh fehlgeschlagen (${res.status}): ${await describeOAuthError(res)}`)
  }

  const data = (await res.json()) as TokenResponse

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    expiresAt: Date.now() + data.expires_in * 1000,
    scope: data.scope,
  }
}

export async function validateToken(accessToken: string): Promise<{ valid: boolean; displayName?: string; email?: string }> {
  try {
    const res = await fetch(`${GRAPH_BASE}/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) return { valid: false }
    const profile = await res.json()
    return {
      valid: true,
      displayName: profile.displayName,
      email: profile.mail || profile.userPrincipalName,
    }
  } catch {
    return { valid: false }
  }
}
