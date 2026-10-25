import { beforeEach, expect, it, vi } from 'vitest';
import { graph, graphList } from '@/lib/meta/graph';
beforeEach(() => { vi.stubEnv('META_GRAPH_VERSION', 'v24.0'); vi.stubEnv('META_APP_SECRET', 'test'); });
it('pins requests to Graph, puts token in authorization, and refuses redirects', async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({ id: '123' })); vi.stubGlobal('fetch', fetcher);
  await graph('123/messages', 'private-token', {}, { text: 'hello' });
  const [url, options] = fetcher.mock.calls[0];
  expect(url.origin).toBe('https://graph.facebook.com'); expect(url.toString()).not.toContain('private-token');
  expect(options.headers.Authorization).toBe('Bearer private-token'); expect(options.redirect).toBe('error');
  expect(options.method).toBe('POST'); expect(JSON.parse(options.body)).toEqual({ text: 'hello' });
});
it('rejects arbitrary URLs and traversal before any request', async () => {
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  for (const path of ['https://evil.test', '../me', 'me?access_token=bad']) await expect(graph(path, 'token')).rejects.toThrow();
  expect(fetcher).not.toHaveBeenCalled();
});
it('ignores provider next URLs and uses cursors on fixed host', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ data: [{ id: '1' }], paging: { next: 'https://evil.test', cursors: { after: 'cursor' } } })).mockResolvedValueOnce(Response.json({ data: [{ id: '2' }] }));
  vi.stubGlobal('fetch', fetcher);
  expect(await graphList('me/accounts', 'token', {})).toHaveLength(2);
  expect(fetcher.mock.calls[1][0].origin).toBe('https://graph.facebook.com');
});
it('does not leak Meta error bodies or retry sends', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response('private-token', { status: 500 })); vi.stubGlobal('fetch', fetcher);
  await expect(graph('123/messages', 'private-token', {}, {})).rejects.toThrow('Meta request failed');
  expect(fetcher).toHaveBeenCalledTimes(1);
});
