import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/lib/auth';

const expired = new Date(0);

function clearCookie(response: NextResponse, secure: boolean) {
  response.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    expires: expired,
    maxAge: 0,
    path: '/'
  });

  response.cookies.set(SESSION_COOKIE, '', {
    httpOnly: false,
    sameSite: 'lax',
    secure,
    expires: expired,
    maxAge: 0,
    path: '/'
  });
}

function logout(request: NextRequest) {
  const response = NextResponse.redirect(new URL('/auth/signed-out', request.url), { status: 303 });
  clearCookie(response, true);
  clearCookie(response, false);
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  return response;
}

export async function GET(request: NextRequest) {
  return logout(request);
}

export async function POST(request: NextRequest) {
  return logout(request);
}
