import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { authenticatePersonalAccessToken } from '@/lib/apiTokens';
import { createBuddiesMcpServer } from '@/lib/mcp/server';
import { rateLimit } from '@/lib/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function unauthorized(message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status: 401,
    headers: { 'content-type': 'application/json', 'www-authenticate': 'Bearer' }
  });
}

function extractBearerToken(request: Request) {
  const header = request.headers.get('authorization');
  const [scheme, value] = header?.split(' ') ?? [];
  return scheme?.toLowerCase() === 'bearer' && value ? value.trim() : null;
}

// A new McpServer + transport per request: there is no persistent process to register
// tools against once in a serverless deployment, and the transport runs in stateless
// mode (sessionIdGenerator: undefined) since each request is independently authenticated
// and self-contained.
async function handle(request: Request) {
  const token = extractBearerToken(request);
  if (!token) return unauthorized('A personal access token is required.');

  const user = await authenticatePersonalAccessToken(token);
  if (!user) return unauthorized('Invalid or revoked personal access token.');

  const limit = await rateLimit('mcp:request', user.id, 120, 60);
  if (!limit.allowed) {
    return new Response(JSON.stringify({ error: 'Too many MCP requests. Try again shortly.' }), {
      status: 429,
      headers: { 'content-type': 'application/json', 'retry-after': String(limit.retryAfterSeconds) }
    });
  }

  const server = createBuddiesMcpServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true
  });
  await server.connect(transport);

  return transport.handleRequest(request, {
    authInfo: { token, clientId: user.id, scopes: ['buddies:read'], extra: { userId: user.id } }
  });
}

export const GET = handle;
export const POST = handle;
export const DELETE = handle;
