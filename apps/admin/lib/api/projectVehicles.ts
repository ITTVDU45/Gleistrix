import { postJSON, putJSON, delJSON } from '@/lib/http/apiClient'

type AssignBody = { date: string; vehicle: any }
type UpdateBody = { date: string; vehicleId: string; updatedFields: Record<string, any> }
type UnassignBody = { date: string; vehicleId: string }

export const ProjectVehiclesApi = {
  assign: (projectId: string, body: AssignBody) =>
    postJSON(`/api/projects/${projectId}/fahrzeuge`, body, 'project-vehicle:assign'),

  update: (projectId: string, body: UpdateBody) =>
    putJSON(`/api/projects/${projectId}/fahrzeuge`, body, 'project-vehicle:update'),

  unassign: (projectId: string, body: UnassignBody) =>
    delJSON(`/api/projects/${projectId}/fahrzeuge`, 'project-vehicle:unassign', {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
}


