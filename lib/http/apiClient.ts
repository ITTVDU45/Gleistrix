import { fetchWithIntent, type IntentKey } from '@/lib/http/fetchWithIntent'

type JsonBody = Record<string, unknown> | undefined

async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text()
  try {
    return text ? (JSON.parse(text) as T) : ({} as T)
  } catch {
    // Non-JSON response
    return {} as T
  }
}

export async function getJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetchWithIntent(url, init)
  if (!res.ok) {
    const bodyText = await res.text().catch(() => '')
    const snippet = bodyText?.slice(0, 500) || ''
    throw new Error(`[GET] ${url} → ${res.status} ${res.statusText}${snippet ? ` | body: ${snippet}` : ''}`)
  }
  return parseJson<T>(res)
}

export async function postJSON<T>(url: string, body?: JsonBody, intent?: IntentKey, init?: RequestInit): Promise<T> {
  const res = await fetchWithIntent(url, {
    method: 'POST',
    intent,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    body: body ? JSON.stringify(body) : undefined,
    ...init,
  })
  if (!res.ok) {
    const bodyText = await res.text().catch(() => '')
    const snippet = bodyText?.slice(0, 500) || ''
    throw new Error(`[POST] ${url} → ${res.status} ${res.statusText}${snippet ? ` | body: ${snippet}` : ''}`)
  }
  return parseJson<T>(res)
}

export async function putJSON<T>(url: string, body?: JsonBody, intent?: IntentKey, init?: RequestInit): Promise<T> {
  const res = await fetchWithIntent(url, {
    method: 'PUT',
    intent,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    body: body ? JSON.stringify(body) : undefined,
    ...init,
  })
  if (!res.ok) {
    const bodyText = await res.text().catch(() => '')
    const snippet = bodyText?.slice(0, 500) || ''
    throw new Error(`[PUT] ${url} → ${res.status} ${res.statusText}${snippet ? ` | body: ${snippet}` : ''}`)
  }
  return parseJson<T>(res)
}

export async function delJSON<T>(url: string, intent?: IntentKey, init?: RequestInit): Promise<T> {
  const res = await fetchWithIntent(url, {
    method: 'DELETE',
    intent,
    ...(init || {}),
  })
  if (!res.ok) {
    const bodyText = await res.text().catch(() => '')
    const snippet = bodyText?.slice(0, 500) || ''
    throw new Error(`[DELETE] ${url} → ${res.status} ${res.statusText}${snippet ? ` | body: ${snippet}` : ''}`)
  }
  return parseJson<T>(res)
}


