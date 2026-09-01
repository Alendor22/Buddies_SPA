import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { getClerkPublishableKey } from '@/lib/clerkConfig';

const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/dogs/new(.*)',
  '/dogs/edit(.*)',
  '/logout(.*)'
]);

const legacyAuthRoutes: Record<string, string> = {
  '/auth/login': '/sign-in',
  '/auth/register': '/sign-up',
  '/auth/forgot-password': '/sign-in',
  '/auth/reset-password': '/sign-in',
  '/auth/check-email': '/sign-in',
  '/auth/register/confirm': '/sign-up',
  '/auth/verify-email': '/sign-in',
  '/auth/signed-out': '/'
};

export default clerkMiddleware(async (auth, request) => {
  const replacement = legacyAuthRoutes[request.nextUrl.pathname];
  if (replacement) {
    return NextResponse.redirect(new URL(replacement, request.url));
  }

  if (isProtectedRoute(request)) {
    await auth.protect();
  }
}, {
  publishableKey: getClerkPublishableKey()
});

export const config = {
  matcher: [
    // Health must remain reachable when Clerk itself is misconfigured so readiness
    // probes can return the intended structured 503 instead of failing in middleware.
    '/((?!api/health(?:/|$)|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|woff2?|ttf)$).*)'
  ]
};
