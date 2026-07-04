import { NextRequest, NextResponse } from 'next/server';
import { encodeSession, hashPassword, normalizeEmail, sessionCookieOptions, SESSION_COOKIE } from '@/lib/auth';
import { prisma } from '@/lib/db';

function valueFrom(params: URLSearchParams | FormData, key: string) {
  return String(params.get(key) ?? '').trim();
}

function escapeHtml(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

function html(title: string, message: string, href: string, linkText: string, status = 200) {
  return new NextResponse(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>body{margin:0;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#f8fafc;color:#0f172a;display:grid;min-height:100vh;place-items:center;padding:24px}main{max-width:520px;background:#fff;border:1px solid #e2e8f0;border-radius:24px;padding:28px;box-shadow:0 8px 30px rgba(15,23,42,.08)}p{color:#475569;font-size:18px;line-height:1.5}a{display:inline-block;margin-top:16px;background:#0f172a;color:#fff;text-decoration:none;border-radius:14px;padding:14px 18px;font-weight:700}.secondary{background:#fff;color:#0f172a;border:1px solid #e2e8f0}</style></head><body><main><p style="font-size:14px;font-weight:700;color:#64748b">Buddies V2.2 Native Register Diagnostic</p><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p><a href="${escapeHtml(href)}">${escapeHtml(linkText)}</a><br><a class="secondary" href="/auth/register">Back to create account</a></main></body></html>`, {
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

async function completeRegister(values: URLSearchParams | FormData) {
  const email = normalizeEmail(valueFrom(values, 'email'));
  const displayName = valueFrom(values, 'displayName');
  const password = String(values.get('password') ?? '');

  if (!email || !displayName || password.length < 8) {
    return html('Invalid account details', 'Enter a display name, a valid email, and a password of at least 8 characters.', '/auth/register?error=invalid', 'Back to create account', 400);
  }

  try {
    const existing = await withTimeout(prisma.user.findUnique({ where: { email }, select: { id: true } }), 8000, 'Existing user lookup');
    if (existing) return html('Account already exists', 'That email is already registered. Use sign in instead.', '/auth/login', 'Go to sign in', 409);

    const user = await withTimeout(
      prisma.user.create({
        data: { email, displayName, passwordHash: hashPassword(password), emailVerifiedAt: new Date() },
        select: { id: true, displayName: true }
      }),
      8000,
      'User create'
    );

    const response = html('Account created', `Session created for ${user.displayName}. Continue to your account-bound dashboard.`, '/dashboard', 'Open dashboard');
    response.cookies.set(SESSION_COOKIE, encodeSession(user.id), sessionCookieOptions());
    return response;
  } catch (error) {
    return html('Register database timeout', error instanceof Error ? error.message : 'The database did not respond during registration.', '/auth/register', 'Back to create account', 504);
  }
}

export async function GET(request: NextRequest) {
  return completeRegister(request.nextUrl.searchParams);
}

export async function POST(request: NextRequest) {
  return completeRegister(await request.formData());
}
