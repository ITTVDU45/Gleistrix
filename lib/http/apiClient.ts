import { fetchWithIntent, type IntentKey } from '@/lib/http/fetchWithIntent'

type JsonBody = Record<string, unknown> | undefined

async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text()
  try {
    return text ? (JSON.parse(text) as T) : ({} as T)
  } catch {
    return {} as T
  }
}

function extractApiMessage(bodyText: string, fallback: string): string {
  try {
    const parsed = JSON.parse(bodyText)
    if (typeof parsed?.message === 'string' && parsed.message) return parsed.message
  } catch {}
  return fallback
}

export async function getJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetchWithIntent(url, init)
  if (!res.ok) {
    const bodyText = await res.text().catch(() => '')
    throw new Error(extractApiMessage(bodyText, `Fehler: ${res.status} ${res.statusText}`))
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
    throw new Error(extractApiMessage(bodyText, `Fehler: ${res.status} ${res.statusText}`))
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
    throw new Error(extractApiMessage(bodyText, `Fehler: ${res.status} ${res.statusText}`))
  }
  return parseJson<T>(res)
}

export async function patchJSON<T>(url: string, body?: JsonBody, intent?: IntentKey, init?: RequestInit): Promise<T> {
  const res = await fetchWithIntent(url, {
    method: 'PATCH',
    intent,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    body: body ? JSON.stringify(body) : undefined,
    ...init,
  })
  if (!res.ok) {
    const bodyText = await res.text().catch(() => '')
    throw new Error(extractApiMessage(bodyText, `Fehler: ${res.status} ${res.statusText}`))
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
    throw new Error(extractApiMessage(bodyText, `Fehler: ${res.status} ${res.statusText}`))
  }
  return parseJson<T>(res)
}


