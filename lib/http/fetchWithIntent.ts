export type IntentKey =
  | 'projects:create' | 'projects:update' | 'projects:patch' | 'projects:delete' | 'projects:update-status'
  | 'project-times:create' | 'project-times:update' | 'project-times:delete'
  | 'project-technik:create' | 'project-technik:update' | 'project-technik:delete'
  | 'project-vehicle:assign' | 'project-vehicle:update' | 'project-vehicle:unassign'
  | 'vehicles:create' | 'vehicles:update' | 'vehicles:delete'
  | 'employees:create' | 'employees:update' | 'employees:delete'
  | 'activity:create' | 'activity:pdf-export'
  | 'users:update-role' | 'auth:update-profile'
  | 'invite:create-user' | 'invite:create-admin' | 'invite:delete-all';

type FetchOptions = RequestInit & { intent?: IntentKey };

export async function fetchWithIntent(input: RequestInfo | URL, init: FetchOptions = {}) {
  const { intent, headers, ...rest } = init;
  const mergedHeaders = new Headers(headers || {});
  if (intent) {
    mergedHeaders.set('x-csrf-intent', intent);
  }
  if (!mergedHeaders.has('Content-Type') && rest.body && typeof rest.body === 'string') {
    mergedHeaders.set('Content-Type', 'application/json');
  }
  return fetch(input, { ...rest, headers: mergedHeaders, credentials: 'include' });
}


