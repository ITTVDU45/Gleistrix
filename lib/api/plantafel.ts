import { getJSON, postJSON, putJSON, delJSON } from '@/lib/http/apiClient'
import type {
  PlantafelAssignmentsResponse,
  CreatePlantafelAssignmentRequest,
  UpdatePlantafelAssignmentRequest,
  PlantafelView,
} from '@/components/plantafel/types'
import type { ApiResponse } from '@/types/main'

export const PlantafelApi = {
  getAssignments: (params: {
    from: string
    to: string
    view?: PlantafelView
    employeeIds?: string[]
    projectIds?: string[]
    showAbsences?: boolean
  }) => {
    const search = new URLSearchParams({ from: params.from, to: params.to })
    if (params.view) search.set('view', params.view)
    if (params.employeeIds?.length) search.set('employeeIds', params.employeeIds.join(','))
    if (params.projectIds?.length) search.set('projectIds', params.projectIds.join(','))
    if (params.showAbsences !== undefined) search.set('showAbsences', String(params.showAbsences))
    return getJSON<PlantafelAssignmentsResponse>(`/api/plantafel/assignments?${search.toString()}`)
  },

  createAssignment: (data: CreatePlantafelAssignmentRequest) =>
    postJSON<ApiResponse<{ id: string }>>('/api/plantafel/assignments', data as unknown as Record<string, unknown>, 'plantafel:create'),

  updateAssignment: (id: string, data: UpdatePlantafelAssignmentRequest) =>
    putJSON<ApiResponse<null>>(`/api/plantafel/assignments/${id}`, data as unknown as Record<string, unknown>, 'plantafel:update'),

  deleteAssignment: (id: string) =>
    delJSON<ApiResponse<null>>(`/api/plantafel/assignments/${id}`, 'plantafel:delete'),
}
