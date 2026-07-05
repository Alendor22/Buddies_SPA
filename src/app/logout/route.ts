import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const SESSION_COOKIE = 'buddies_session';
const LOGOUT_COOKIE = 'buddies_signed_out';

function cookie(name: string, value: string, maxAge: number, httpOnly: boolean) {
  return [
    `${name}=${value}`,
    `Max-Age=${maxAge}`,
    maxAge === 0 ? 'Expires=Thu, 01 Jan 1970 00:00:00 GMT' : '',
    'Path=/',
    'SameSite=Lax',
    'Secure',
    httpOnly ? 'HttpOnly' : ''
  ].filter(Boolean).join('; ');
}

export async function GET(_request: NextRequest) {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="cache-control" content="no-store"><title>Signed out · Buddies</title><style>body{margin:0;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#f8fafc;color:#0f172a;display:grid;min-height:100vh;place-items:center;padding:24px}main{width:min(100%,480px);background:white;border:1px solid #e2e8f0;border-radius:24px;padding:28px;box-shadow:0 10px 32px rgba(15,23,42,.08)}p{color:#475569;font-size:18px;line-height:1.5}.tag{font-size:14px;font-weight:700;color:#64748b}a{display:block;text-align:center;text-decoration:none;border-radius:14px;padding:14px 18px;font-weight:700;margin-top:12px}.primary{background:#0f172a;color:white}.secondary{border:1px solid #e2e8f0;color:#0f172a;background:white}</style></head><body><main><p class="tag">Buddies V2.3 Logout Override</p><h1>Signed out</h1><p>Your Buddies native session was cleared. Cloudflare Access may still be active, but this app now ignores it until you sign in again.</p><a class="primary" href="/auth/login?fresh=1">Sign in again</a><a class="secondary" href="/">Go home</a></main><script>document.cookie='${SESSION_COOKIE}=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/; SameSite=Lax; Secure';document.cookie='${LOGOUT_COOKIE}=1; Max-Age=2592000; Path=/; SameSite=Lax; Secure';</script></body></html>`;
  const response = new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0'
    }
  });
  response.headers.append('Set-Cookie', cookie(SESSION_COOKIE, '', 0, true));
  response.headers.append('Set-Cookie', cookie(SESSION_COOKIE, '', 0, false));
  response.headers.append('Set-Cookie', cookie(LOGOUT_COOKIE, '1', 60 * 60 * 24 * 30, true));
  response.headers.append('Set-Cookie', cookie(LOGOUT_COOKIE, '1', 60 * 60 * 24 * 30, false));
  return response;
}

export async function POST(request: NextRequest) {
  return GET(request);
}
