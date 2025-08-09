import { getJSON, postJSON, putJSON, delJSON } from '@/lib/http/apiClient'
import type { Vehicle } from '@/types/main'

export const VehiclesApi = {
  list: () => getJSON<{ success: boolean; vehicles: Vehicle[] }>('/api/vehicles'),
  create: (data: Partial<Vehicle>) => postJSON('/api/vehicles', data, 'vehicles:create'),
  update: (id: string, data: Partial<Vehicle>) => putJSON(`/api/vehicles/${id}`, data, 'vehicles:update'),
  remove: (id: string) => delJSON(`/api/vehicles/${id}`, 'vehicles:delete'),
}


