'use client';

import { useState, useEffect } from 'react'
import { fetchWithIntent } from '@/lib/http/fetchWithIntent'
import { VehiclesApi } from '@/lib/api/vehicles'
import type { Vehicle } from '../types'

export function useVehicles() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchVehicles() {
      setLoading(true)
      try {
        const data = await VehiclesApi.list()
        const list = (data.vehicles || (data as any).data || []).map((v: any) => ({ ...v, id: v._id?.toString() || v.id }))
        if (list) {
          setVehicles(list)
        } else {
          throw new Error((data as any).message || 'Fehler beim Laden der Fahrzeuge')
        }
        setError(null)
      } catch (err: any) {
        setError(err.message)
      }
      setLoading(false)
    }
    fetchVehicles()
  }, [])

  const addVehicle = async (vehicleData: Partial<Vehicle>) => {
    const data = await VehiclesApi.create(vehicleData)
    const created = (data as any).data || (data as any).vehicle
    if (created) {
      setVehicles(prev => [...prev, { ...created, id: created._id?.toString?.() || created.id }])
    }
  }

  return { vehicles, loading, error, addVehicle }
} 