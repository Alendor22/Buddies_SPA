import { NextRequest, NextResponse } from 'next/server';
import { encodeSession, normalizeEmail, sessionCookieOptions, SESSION_COOKIE, verifyPassword } from '@/lib/auth';
import { prisma } from '@/lib/db';

type UserLoginRecord = { id: string; displayName: string; passwordHash: string | null } | null;

function escapeHtml(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

function html(title: string, message: string, href: string, linkText: string, status = 200) {
  return new NextResponse(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>body{margin:0;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#f8fafc;color:#0f172a;display:grid;min-height:100vh;place-items:center;padding:24px}main{max-width:520px;background:#fff;border:1px solid #e2e8f0;border-radius:24px;padding:28px;box-shadow:0 8px 30px rgba(15,23,42,.08)}p{color:#475569;font-size:18px;line-height:1.5}a{display:inline-block;margin-top:16px;background:#0f172a;color:#fff;text-decoration:none;border-radius:14px;padding:14px 18px;font-weight:700}.secondary{background:#fff;color:#0f172a;border:1px solid #e2e8f0}</style></head><body><main><p style="font-size:14px;font-weight:700;color:#64748b">Buddies V2.2 Native Auth Diagnostic</p><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p><a href="${escapeHtml(href)}">${escapeHtml(linkText)}</a><br><a class="secondary" href="/auth/login">Back to login</a></main></body></html>`, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function completeLogin(values: URLSearchParams | FormData) {
  const email = normalizeEmail(String(values.get('email') ?? ''));
  const password = String(values.get('password') ?? '');

  if (!email || !password) return html('Missing credentials', 'Email and password are required.', '/auth/login?error=missing', 'Back to sign in', 400);

  let user: UserLoginRecord;
  try {
    user = await withTimeout(
      prisma.user.findUnique({ where: { email }, select: { id: true, displayName: true, passwordHash: true } }),
      8000,
      'User lookup'
    );
  } catch (error) {
    return html('Login database timeout', error instanceof Error ? error.message : 'The database did not respond during login.', '/auth/login', 'Back to sign in', 504);
  }

  if (!user || !verifyPassword(password, user.passwordHash)) {
    return html('Invalid credentials', 'The email or password did not match an account.', '/auth/login?error=invalid', 'Back to sign in', 401);
  }

  const response = html('Signed in', `Session created for ${user.displayName}. Continue to your account-bound dashboard.`, '/dashboard', 'Open dashboard');
  response.cookies.set(SESSION_COOKIE, encodeSession(user.id), sessionCookieOptions());
  return response;
}

export async function GET(request: NextRequest) {
  return completeLogin(request.nextUrl.searchParams);
}

export async function POST(request: NextRequest) {
  return completeLogin(await request.formData());
}
