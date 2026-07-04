import { NextRequest, NextResponse } from 'next/server';
import { createSession, normalizeEmail, verifyPassword } from '@/lib/auth';
import { prisma } from '@/lib/db';

function escapeHtml(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function html(title: string, message: string, href: string, linkText: string, status = 200) {
  return new NextResponse(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="refresh" content="0;url=${escapeHtml(href)}"><title>${escapeHtml(title)}</title><style>body{font-family:system-ui;margin:0;min-height:100vh;display:grid;place-items:center;background:#f8fafc;color:#0f172a;padding:24px}main{max-width:520px;background:white;border:1px solid #e2e8f0;border-radius:24px;padding:28px}a{display:inline-block;margin-top:16px;background:#0f172a;color:white;text-decoration:none;border-radius:14px;padding:14px 18px}</style></head><body><main><p>Buddies V2.2 Real Login Confirm Fix</p><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p><a href="${escapeHtml(href)}">${escapeHtml(linkText)}</a></main></body></html>`, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}

async function completeLogin(emailRaw: string, password: string) {
  const email = normalizeEmail(emailRaw);
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, displayName: true, passwordHash: true }
  });

  if (!user || !verifyPassword(password, user.passwordHash)) {
    return html('Invalid credentials', 'The email or password did not match.', '/auth/login?error=invalid', 'Back to sign in', 401);
  }

  await createSession(user.id);
  return html('Signed in', `Signed in as ${user.displayName}. Opening the dashboard now.`, '/dashboard', 'Open dashboard');
}

export async function GET(request: NextRequest) {
  return completeLogin(request.nextUrl.searchParams.get('email') ?? '', request.nextUrl.searchParams.get('password') ?? '');
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  return completeLogin(String(formData.get('email') ?? ''), String(formData.get('password') ?? ''));
}
