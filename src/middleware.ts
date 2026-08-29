import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

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
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)'
  ]
};
