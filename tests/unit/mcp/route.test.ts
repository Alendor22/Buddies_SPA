import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const authenticatePersonalAccessTokenMock = vi.hoisted(() => vi.fn());
const rateLimitMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/apiTokens', () => ({ authenticatePersonalAccessToken: authenticatePersonalAccessTokenMock }));
vi.mock('@/lib/rateLimit', () => ({ rateLimit: rateLimitMock }));
// None of these tests reach the point of creating a real MCP server/transport (each
// returns before that), but the route module imports it at load time, which
// transitively imports the Prisma client and throws without a real DATABASE_URL.
vi.mock('@/lib/mcp/server', () => ({ createBuddiesMcpServer: vi.fn() }));

import { GET, POST } from '@/app/api/mcp/route';

function request(method: 'GET' | 'POST', headers: Record<string, string> = {}) {
  return new NextRequest(new URL('/api/mcp', 'http://localhost:3000'), { method, headers });
}

describe('MCP route', () => {
  it('declines GET with 405 instead of opening a server-push stream the server never uses', async () => {
    const response = await GET();

    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toContain('POST');
    expect(authenticatePersonalAccessTokenMock).not.toHaveBeenCalled();
  });

  it('rejects a POST with no bearer token before touching the MCP transport', async () => {
    const response = await POST(request('POST'));

    expect(response.status).toBe(401);
    expect(authenticatePersonalAccessTokenMock).not.toHaveBeenCalled();
  });

  it('rejects a POST with an invalid or revoked token', async () => {
    authenticatePersonalAccessTokenMock.mockResolvedValueOnce(null);
    const response = await POST(request('POST', { authorization: 'Bearer bdy_pat_invalid' }));

    expect(response.status).toBe(401);
  });
});
