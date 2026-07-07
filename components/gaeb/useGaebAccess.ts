'use client'

import { useEffect, useState } from 'react'
import { AuthApi } from '@/lib/api/auth'

/**
 * Prüft, ob der aktuelle Nutzer GAEB-Funktionen sehen darf (admin/superadmin).
 * GAEB ist bewusst admin-only – die UI-Einstiegspunkte werden entsprechend
 * ein-/ausgeblendet.
 */
export function useGaebAccess(): { isGaebAdmin: boolean; isLoading: boolean } {
  const [isGaebAdmin, setIsGaebAdmin] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    AuthApi.me()
      .then((data) => {
        if (cancelled) return
        const role = (data as { user?: { role?: string } })?.user?.role
        setIsGaebAdmin(role === 'admin' || role === 'superadmin')
      })
      .catch(() => {
        if (!cancelled) setIsGaebAdmin(false)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { isGaebAdmin, isLoading }
}
