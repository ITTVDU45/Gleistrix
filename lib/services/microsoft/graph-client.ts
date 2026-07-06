import dbConnect from '@/lib/dbConnect'
import IntegrationConfig from '@/lib/models/IntegrationConfig'
import { refreshAccessToken, type TokenSet } from './oauth'

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0'

interface MicrosoftIntegrationDoc {
  integrationId: string
  status: string
  config: {
    clientId: string
    clientSecret: string
    redirectUri: string
    tenantMode: string
    enabledModules: string[]
    tokens?: TokenSet
    [key: string]: unknown
  }
}

async function getConfigDoc(): Promise<MicrosoftIntegrationDoc | null> {
  await dbConnect()
  const doc = await IntegrationConfig.findOne({ integrationId: 'microsoft' }).lean()
  return doc as unknown as MicrosoftIntegrationDoc | null
}

async function getValidAccessToken(): Promise<string> {
  const doc = await getConfigDoc()
  if (!doc || doc.status !== 'connected') {
    throw new Error('Microsoft 365 ist nicht verbunden')
  }

  const { config } = doc
  const tokens = config.tokens
  if (!tokens) {
    throw new Error('Keine Tokens vorhanden — bitte erneut verbinden')
  }

  const REFRESH_BUFFER_MS = 5 * 60 * 1000
  if (tokens.expiresAt > Date.now() + REFRESH_BUFFER_MS) {
    return tokens.accessToken
  }

  const refreshed = await refreshAccessToken(
    {
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      redirectUri: config.redirectUri,
      tenantMode: config.tenantMode,
    },
    tokens.refreshToken
  )

  await IntegrationConfig.findOneAndUpdate(
    { integrationId: 'microsoft' },
    {
      $set: {
        'config.tokens': refreshed,
        lastCheckedAt: new Date(),
        lastError: null,
      },
    }
  )

  return refreshed.accessToken
}

interface GraphRequestOptions {
  method?: string
  body?: unknown
  headers?: Record<string, string>
}

export async function graphRequest<T = unknown>(path: string, options: GraphRequestOptions = {}): Promise<T> {
  const accessToken = await getValidAccessToken()
  const { method = 'GET', body, headers = {} } = options

  const fetchHeaders: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    ...headers,
  }

  if (body && !fetchHeaders['Content-Type']) {
    fetchHeaders['Content-Type'] = 'application/json'
  }

  const res = await fetch(`${GRAPH_BASE}${path}`, {
    method,
    headers: fetchHeaders,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`Graph API ${method} ${path} failed: ${res.status} ${errText.slice(0, 500)}`)
  }

  if (res.status === 204) return {} as T

  const text = await res.text()
  return text ? (JSON.parse(text) as T) : ({} as T)
}

export async function graphGet<T = unknown>(path: string): Promise<T> {
  return graphRequest<T>(path)
}

export async function graphPost<T = unknown>(path: string, body: unknown): Promise<T> {
  return graphRequest<T>(path, { method: 'POST', body })
}

export async function graphPatch<T = unknown>(path: string, body: unknown): Promise<T> {
  return graphRequest<T>(path, { method: 'PATCH', body })
}

export async function graphDelete(path: string): Promise<void> {
  await graphRequest(path, { method: 'DELETE' })
}

export async function graphUpload(path: string, content: Buffer | Uint8Array, contentType: string): Promise<unknown> {
  const accessToken = await getValidAccessToken()

  const res = await fetch(`${GRAPH_BASE}${path}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': contentType,
    },
    body: content,
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`Graph upload ${path} failed: ${res.status} ${errText.slice(0, 500)}`)
  }

  return res.json()
}
