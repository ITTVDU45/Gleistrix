export type IntentKey =
  | 'projects:create' | 'projects:update' | 'projects:patch' | 'projects:delete' | 'projects:update-status'
  | 'project-times:create' | 'project-times:update' | 'project-times:delete'
  | 'project-technik:create' | 'project-technik:update' | 'project-technik:delete'
  | 'project-vehicle:assign' | 'project-vehicle:update' | 'project-vehicle:unassign'
  | 'vehicles:create' | 'vehicles:update' | 'vehicles:delete'
  | 'employees:create' | 'employees:update' | 'employees:delete'
  | 'activity:create' | 'activity:pdf-export'
  | 'users:update-role' | 'auth:update-profile'
  | 'invite:create-user' | 'invite:create-admin' | 'invite:delete-all' | 'invite:activate-user'
  | 'lager:article:create' | 'lager:article:update' | 'lager:article:delete'
  | 'lager:article:image:presign' | 'lager:article:image:commit' | 'lager:article:image:delete' | 'lager:article:image:upload'
  | 'lager:category:create' | 'lager:category:update' | 'lager:category:delete'
  | 'lager:movement:create' | 'lager:assignments:create' | 'lager:assignments:bulk' | 'lager:assignments:return'
  | 'lager:recipient:create'
  | 'lager:partner:create' | 'lager:partner:update'
  | 'lager:maintenance:create' | 'lager:maintenance:update' | 'lager:maintenance:delete'
  | 'lager:delivery-note:create' | 'lager:delivery-note:update' | 'lager:delivery-note:attachment:presign' | 'lager:delivery-note:attachment:commit' | 'lager:delivery-note:attachment:delete'
  | 'lager:inventory:create' | 'lager:inventory:update' | 'lager:inventory:scan' | 'lager:inventory:scan-session' | 'lager:inventory:delete' | 'lager:inventory:complete'
  | 'lager:unit:create' | 'lager:unit:update' | 'lager:unit:delete' | 'lager:unit:bulk'
  | 'lager:article-type:create';

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






