import { getJSON, postJSON, putJSON, delJSON } from '@/lib/http/apiClient'
import type { Project } from '@/types/main'

/**
 * Payload für PUT /api/projects/[id]: entweder Feld-Updates (Partial<Project>)
 * oder eine der Aktionen für Zeiten/Technik/Fahrzeuge (serverseitig via Zod
 * validiert).
 */
export type ProjectUpdatePayload =
  | Partial<Project>
  | { times: Record<string, unknown> }
  | { technik: Record<string, unknown> }
  | { vehicles: Record<string, unknown> }

export const ProjectsApi = {
  list: (
    page = 0,
    limit = 50,
    q = '',
    opts?: { includeTimes?: boolean; includeVehicles?: boolean; includeTechnik?: boolean }
  ) => {
    const search = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      q: q || ''
    });
    if (opts?.includeTimes) search.set('includeTimes', 'true');
    if (opts?.includeVehicles) search.set('includeVehicles', 'true');
    if (opts?.includeTechnik) search.set('includeTechnik', 'true');
    return getJSON<{ success: boolean; projects: Project[]; message?: string; meta?: { total: number; page: number; limit: number } }>(`/api/projects?${search.toString()}`);
  },
  get: (id: string) => {
    if (!id || id === 'undefined') throw new Error('ProjectsApi.get: invalid id')
    return getJSON<{ success?: boolean; project?: Project }>(`/api/projects/${id}`)
  },
  create: (data: Partial<Project>) => postJSON<{ success: boolean; project: Project }>('/api/projects', data, 'projects:create'),
  update: (id: string, data: ProjectUpdatePayload) => {
    if (!id || id === 'undefined') throw new Error('ProjectsApi.update: invalid id')
    return putJSON<Project>(`/api/projects/${id}`, data as Record<string, unknown>, 'projects:update')
  },
  updateStatus: (id: string, status: string) => {
    if (!id || id === 'undefined') throw new Error('ProjectsApi.updateStatus: invalid id')
    return putJSON<Project>(`/api/projects/${id}/status`, { status }, 'projects:update-status')
  },
  remove: (id: string) => {
    if (!id || id === 'undefined') throw new Error('ProjectsApi.remove: invalid id')
    return delJSON<{ message?: string; success?: boolean }>(`/api/projects/${id}`, 'projects:delete')
  },
  bulkDelete: async (projectIds: string[]): Promise<{ deletedCount: number; cleanedEmployees: number; message: string }> => {
    if (!Array.isArray(projectIds) || projectIds.length === 0) {
      throw new Error('ProjectsApi.bulkDelete: projectIds must be a non-empty array')
    }
    const res = await fetch('/api/projects/bulk-delete', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-csrf-intent': 'projects:bulk-delete'
      },
      credentials: 'include',
      body: JSON.stringify({ projectIds })
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: 'Unbekannter Fehler' }));
      throw new Error(error.message || 'Fehler beim Löschen der Projekte');
    }
    return res.json();
  },
  uploadDocuments: (id: string, formData: any) => {
    if (!id || id === 'undefined') throw new Error('ProjectsApi.uploadDocuments: invalid id')
    return fetch(`/api/projects/${id}/documents`, { method: 'POST', body: formData }).then(r => r.json())
  },
  updateDocumentDescription: (id: string, docId: string, data: any) => {
    if (!id || id === 'undefined') throw new Error('ProjectsApi.updateDocumentDescription: invalid id')
    return fetch(`/api/projects/${id}/documents/${docId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(r => r.json())
  }
  ,
  getDocumentPresignedUrl: (id: string, docId: string) => fetch(`/api/projects/${id}/documents/${docId}/presign`, { credentials: 'include' }).then(r => r.json())
  ,
  deleteDocument: (id: string, docId: string) => fetch(`/api/projects/${id}/documents/${docId}`, { method: 'DELETE' }).then(r => r.json())
}


