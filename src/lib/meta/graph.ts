import { createHmac } from 'node:crypto';
import { MetaError, required } from './security';

export function version() {
  const value = required('META_GRAPH_VERSION');
  if (!/^v\d+\.0$/.test(value)) throw new MetaError(503, 'Invalid Meta API version.');
  return value;
}
export async function graph<T>(path: string, token: string, params: Record<string, string> = {}, body?: unknown): Promise<T> {
  if (!/^[a-zA-Z0-9_]+(?:\/[a-zA-Z0-9_]+)*$/.test(path)) throw new MetaError(400, 'Invalid Meta asset.');
  const url = new URL(`https://graph.facebook.com/${version()}/${path}`);
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
  url.searchParams.set('appsecret_proof', createHmac('sha256', required('META_APP_SECRET')).update(token).digest('hex'));
  const response = await fetch(url, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) throw new MetaError(response.status === 429 ? 429 : 502, 'Meta request failed. Check permissions and connection status.');
  return response.json() as Promise<T>;
}
// Follow cursors only on the fixed Graph host; never fetch provider-supplied next URLs.
export async function graphList<T>(path: string, token: string, params: Record<string, string>) {
  const result: T[] = [];
  let after: string | undefined;
  for (let page = 0; page < 20; page++) {
    const response = await graph<{ data: T[]; paging?: { next?: string; cursors?: { after?: string } } }>(path, token, { ...params, limit: '100', ...(after ? { after } : {}) });
    result.push(...response.data);
    if (!response.paging?.next) return result;
    after = response.paging.cursors?.after;
    if (!after) break;
  }
  throw new MetaError(422, 'Too many Meta assets. Connection was not saved.');
}
export async function exchangeCode(code: string, redirectUri: string) {
  const response = await fetch(`https://graph.facebook.com/${version()}/oauth/access_token`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: required('META_APP_ID'), client_secret: required('META_APP_SECRET'), redirect_uri: redirectUri, code }),
    cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) throw new MetaError(502, 'Meta authorization exchange failed.');
  return response.json() as Promise<{ access_token: string; expires_in?: number }>;
}
