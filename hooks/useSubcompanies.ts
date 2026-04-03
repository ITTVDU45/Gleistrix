'use client'
import { useEffect, useState } from 'react'
import { SubcompaniesApi } from '@/lib/api/subcompanies'
import type { Subcompany } from '@/types/main'

export function useSubcompanies() {
  const [subcompanies, setSubcompanies] = useState<Subcompany[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const data = await SubcompaniesApi.list()
        if (data.success && data.subcompanies) {
          setSubcompanies(
            data.subcompanies.map((s: any) => ({
              ...s,
              id: s._id || s.id,
            }))
          )
        } else {
          throw new Error((data as any).message || 'Fehler beim Laden der Subunternehmen')
        }
        setError(null)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    load()

    const handleSubcompanyAdded = (event: CustomEvent) => {
      const created = {
        ...event.detail,
        id: event.detail._id || event.detail.id,
      }
      setSubcompanies(prev => [...prev, created])
    }

    window.addEventListener('subcompanyAdded', handleSubcompanyAdded as EventListener)

    return () => {
      window.removeEventListener('subcompanyAdded', handleSubcompanyAdded as EventListener)
    }
  }, [])

  const addSubcompany = async (payload: Partial<Subcompany>) => {
    const res: any = await SubcompaniesApi.create(payload)
    if (res?.success && res.subcompany) {
      const created = { ...res.subcompany, id: res.subcompany._id || res.subcompany.id }
      setSubcompanies(prev => [...prev, created])
      return created
    }
    throw new Error(res?.message || 'Fehler beim Anlegen des Subunternehmens')
  }

  const updateSubcompany = async (id: string, payload: Partial<Subcompany>) => {
    const res: any = await SubcompaniesApi.update(id, payload)
    if (res?.success && res.subcompany) {
      const updated = { ...res.subcompany, id: res.subcompany._id || res.subcompany.id }
      setSubcompanies(prev => prev.map(s => (s.id === id ? updated : s)))
      return updated
    }
    throw new Error(res?.message || 'Fehler beim Aktualisieren des Subunternehmens')
  }

  const deleteSubcompany = async (id: string) => {
    const res: any = await SubcompaniesApi.remove(id)
    if (res?.success) {
      setSubcompanies(prev => prev.filter(s => s.id !== id))
      return true
    }
    throw new Error(res?.message || 'Fehler beim Loeschen des Subunternehmens')
  }

  return { subcompanies, loading, error, addSubcompany, updateSubcompany, deleteSubcompany }
}
