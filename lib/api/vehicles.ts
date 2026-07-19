import { getJSON, postJSON, putJSON, delJSON } from '@/lib/http/apiClient'
import type { Vehicle } from '@/types/main'

/** Die API liefert Mongo-Dokumente, d. h. zusätzlich zum `id` auch `_id`. */
export type ApiVehicle = Vehicle & { _id?: string }

export interface VehicleListResponse {
  success?: boolean
  vehicles?: ApiVehicle[]
  data?: ApiVehicle[]
  message?: string
}

export interface VehicleItemResponse {
  success?: boolean
  vehicle?: ApiVehicle
  data?: ApiVehicle
  message?: string
}

export interface VehicleMutationResponse {
  success?: boolean
  message?: string
}

export const VehiclesApi = {
  list: () => getJSON<VehicleListResponse>('/api/vehicles'),
  create: (data: Partial<Vehicle>) => postJSON<VehicleItemResponse>('/api/vehicles', data, 'vehicles:create'),
  update: (id: string, data: Partial<Vehicle>) => putJSON<VehicleItemResponse>(`/api/vehicles/${id}`, data, 'vehicles:update'),
  remove: (id: string) => delJSON<VehicleMutationResponse>(`/api/vehicles/${id}`, 'vehicles:delete'),
}
