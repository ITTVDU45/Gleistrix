import { beforeEach, describe, expect, test, vi } from 'vitest'
import { NextRequest } from 'next/server'

const requireAuthMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/security/requireAuth', () => ({ requireAuth: requireAuthMock }))

import { requireFinanceAccess } from './apiGuard'

describe('Finanzzugriff', () => {
  beforeEach(() => requireAuthMock.mockReset())

  test.each([
    [{ ok: false, status: 401, error: 'Nicht angemeldet' }, 401],
    [{ ok: false, status: 403, error: 'Keine Berechtigung' }, 403],
  ])('reicht %s als HTTP-Status weiter', async (authResult, status) => {
    requireAuthMock.mockResolvedValue(authResult)
    const response = await requireFinanceAccess(new NextRequest('http://localhost/api/finanzen/overview'))
    expect(response?.status).toBe(status)
  })

  test('fordert ausschließlich die Super-Admin-Rolle an', async () => {
    requireAuthMock.mockResolvedValue({ ok: true, token: { role: 'superadmin' } })
    const response = await requireFinanceAccess(new NextRequest('http://localhost/api/finanzen/overview'))
    expect(response).toBeNull()
    expect(requireAuthMock).toHaveBeenCalledWith(expect.any(NextRequest), ['superadmin'])
  })
})
