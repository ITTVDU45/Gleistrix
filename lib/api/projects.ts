import { getJSON, postJSON, putJSON, delJSON } from '@/lib/http/apiClient'
import type { Project } from '@/types'

export const ProjectsApi = {
  list: () => getJSON<{ success: boolean; projects: Project[] }>('/api/projects'),
  create: (data: Partial<Project>) => postJSON<{ success: boolean; project: Project }>('/api/projects', data, 'projects:create'),
  update: (id: string, data: Partial<Project>) => putJSON<Project>(`/api/projects/${id}`, data, 'projects:update'),
  updateStatus: (id: string, status: string) => putJSON<Project>(`/api/projects/${id}/status`, { status }, 'projects:update-status'),
  remove: (id: string) => delJSON<{ message: string }>(`/api/projects/${id}`, 'projects:delete'),
}


