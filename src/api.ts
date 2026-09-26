let workspace = 'default';
const tokens = new Map<string, string>();
export function selectWorkspace(id: string) {
  workspace = id;
}
export function apiUrl(path: string, id = workspace) {
  return `/api${path}${path.includes('?') ? '&' : '?'}workspace=${encodeURIComponent(id)}`;
}
export async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const id = workspace;
  if (method !== 'GET' && !tokens.has(id)) {
    const response = await fetch(apiUrl('/session', id));
    if (!response.ok) throw new Error('Cannot connect to this project. Reload Devloom.');
    tokens.set(id, (await response.json()).token);
  }
  const response = await fetch(apiUrl(path, id), {
    method,
    headers:
      method === 'GET'
        ? {}
        : {
            'Content-Type': 'application/json',
            'X-Devloom-Token': tokens.get(id)!,
          },
    body: method === 'GET' ? undefined : JSON.stringify(body ?? {}),
  });
  if (!response.ok) {
    if (response.status === 403) tokens.delete(id);
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `Request failed (${response.status}).`);
  }
  return response.status === 204 ? (undefined as T) : response.json();
}
