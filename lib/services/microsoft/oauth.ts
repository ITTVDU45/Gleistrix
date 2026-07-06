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
    client_id: config.clientId,
    response_type: 'code',
    redirect_uri: config.redirectUri,
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
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    redirect_uri: config.redirectUri,
    grant_type: 'authorization_code',
    scope: scopes,
  })

  const res = await fetch(`${AUTHORITY_BASE}/${tenant}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!res.ok) {
    const errBody = await res.text()
    throw new Error(`Token exchange failed: ${res.status} ${errBody}`)
  }

  const data = (await res.json()) as TokenResponse

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || '',
    expiresAt: Date.now() + data.expires_in * 1000,
    scope: data.scope,
  }
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
    const errBody = await res.text()
    throw new Error(`Token refresh failed: ${res.status} ${errBody}`)
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
