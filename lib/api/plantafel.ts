import { getJSON, postJSON, patchJSON, delJSON } from '@/lib/http/apiClient'
import type {
  PlantafelAssignmentsResponse,
  PlantafelDayResponse,
  CreatePlantafelAssignmentRequest,
  UpdatePlantafelAssignmentRequest,
  PlantafelView,
} from '@/components/plantafel/types'
import type { ApiResponse } from '@/types/main'

export interface MeetingSyncResult {
  created: boolean
  joinUrl?: string | null
  eventId?: string | null
  reason?: string
}

export const PlantafelApi = {
  getAssignments: (params: {
    from: string
    to: string
    view?: PlantafelView
    employeeIds?: string[]
    projectIds?: string[]
    showAbsences?: boolean
    showGermanHolidays?: boolean
    showIslamicHolidays?: boolean
    showProjects?: boolean
    hiddenProjectStatuses?: string[]
  }) => {
    const search = new URLSearchParams({ from: params.from, to: params.to })
    if (params.view) search.set('view', params.view)
    if (params.employeeIds?.length) search.set('employeeIds', params.employeeIds.join(','))
    if (params.projectIds?.length) search.set('projectIds', params.projectIds.join(','))
    if (params.showAbsences !== undefined) search.set('showAbsences', String(params.showAbsences))
    if (params.showGermanHolidays !== undefined) search.set('showGermanHolidays', String(params.showGermanHolidays))
    if (params.showIslamicHolidays !== undefined) search.set('showIslamicHolidays', String(params.showIslamicHolidays))
    if (params.showProjects !== undefined) search.set('showProjects', String(params.showProjects))
    if (params.hiddenProjectStatuses?.length) search.set('hiddenProjectStatuses', params.hiddenProjectStatuses.join(','))
    return getJSON<PlantafelAssignmentsResponse>(`/api/plantafel/assignments?${search.toString()}`)
  },

  getDayProjects: (dateKey: string) =>
    getJSON<PlantafelDayResponse>(`/api/plantafel/day?date=${encodeURIComponent(dateKey)}`),

  createAssignment: (data: CreatePlantafelAssignmentRequest) =>
    postJSON<ApiResponse<{ id: string }>>('/api/plantafel/assignments', data as unknown as Record<string, unknown>, 'plantafel:create'),

  updateAssignment: (id: string, data: UpdatePlantafelAssignmentRequest) =>
    patchJSON<ApiResponse<null>>(`/api/plantafel/assignments/${id}`, data as unknown as Record<string, unknown>, 'plantafel:update'),

  deleteAssignment: (id: string) =>
    delJSON<ApiResponse<null>>(`/api/plantafel/assignments/${id}`, 'plantafel:delete'),

  createMeeting: (data: {
    titel: string
    von: string
    bis: string
    notizen?: string
    attendees: Array<{ employeeId?: string | null; name?: string; email: string }>
  }) =>
    postJSON<ApiResponse<{ id: string; sync?: MeetingSyncResult }>>(
      '/api/plantafel/meetings',
      data as unknown as Record<string, unknown>,
      'plantafel:meeting:create'
    ),

  getMeeting: (id: string) =>
    getJSON<ApiResponse<{
      _id: string
      titel: string
      von: string
      bis: string
      notizen?: string
      attendees?: Array<{ employeeId?: string | null; name?: string; email: string }>
    }>>(`/api/plantafel/meetings/${id}`),

  updateMeeting: (
    id: string,
    data: {
      titel: string
      von: string
      bis: string
      notizen?: string
      attendees: Array<{ employeeId?: string | null; name?: string; email: string }>
    }
  ) =>
    patchJSON<ApiResponse<{ sync?: MeetingSyncResult }>>(
      `/api/plantafel/meetings/${id}`,
      data as unknown as Record<string, unknown>,
      'plantafel:meeting:update'
    ),

  deleteMeeting: (id: string) =>
    delJSON<ApiResponse<null>>(`/api/plantafel/meetings/${id}`, 'plantafel:meeting:delete'),
}
