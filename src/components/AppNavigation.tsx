'use client';

import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import AccountActions from '@/components/AccountActions';
import FeaturesRibbon from '@/components/FeaturesRibbon';
import NavStackClient, { useNavStack } from '@/components/NavStackClient';
import RealtimeNotificationBell from '@/components/RealtimeNotificationBell';

type AppNavigationProps = { signedIn: boolean; initial: string; notificationCount: number };

function titleForPath(pathname: string) {
  if (pathname === '/') return 'Home';
  if (pathname.startsWith('/scanner')) return 'Scan Dog Tag';
  if (pathname.startsWith('/dashboard/lost')) return 'Lost Dog';
  if (pathname.startsWith('/dashboard/check-ins')) return 'Dog Check-ins';
  if (pathname.startsWith('/dashboard/messages')) return 'Messages';
  if (pathname.includes('/dashboard/walks/') && pathname.endsWith('/messages')) return 'Walk Chat';
  if (pathname.startsWith('/dashboard/walks/new')) return 'Create Walk';
  if (pathname.startsWith('/dashboard/walks')) return 'Walks';
  if (pathname.startsWith('/dashboard/buddies/invite')) return 'Invite Buddy';
  if (pathname.startsWith('/dashboard/buddies')) return 'Buddies';
  if (pathname.startsWith('/dashboard/notifications')) return 'Alerts';
  if (pathname.startsWith('/dashboard/menu') || pathname.startsWith('/dashboard/account')) return 'Account';
  if (pathname.startsWith('/dashboard')) return 'Dashboard';
  if (pathname.startsWith('/dogs/new')) return 'Add Profile';
  if (pathname.startsWith('/dogs/edit')) return 'Edit Profile';
  if (pathname.includes('/qr')) return 'QR Profile';
  if (pathname.startsWith('/dogs/')) return 'Dog Profile';
  if (pathname.startsWith('/dogs')) return 'Profiles';
  if (pathname.startsWith('/map')) return 'Spatial Map';
  if (pathname.startsWith('/sign-in') || pathname.startsWith('/auth/login')) return 'Sign in';
  if (pathname.startsWith('/sign-up') || pathname.startsWith('/auth/register')) return 'Create account';
  if (pathname.startsWith('/logout')) return 'Signed out';
  return 'Buddies';
}

function fallbackPath(pathname: string) {
  if (pathname.startsWith('/dogs/new') || pathname.startsWith('/dogs/edit') || pathname.startsWith('/dogs/')) return '/dogs';
  if (pathname.startsWith('/dashboard/check-ins')) return '/dashboard/buddies';
  if (pathname.startsWith('/dashboard/messages')) return '/dashboard';
  if (pathname.includes('/dashboard/walks/') && pathname.endsWith('/messages')) return '/dashboard/messages';
  if (pathname.startsWith('/dashboard/walks')) return '/dashboard/buddies';
  if (pathname.startsWith('/dashboard/lost')) return '/dashboard/notifications';
  if (pathname.startsWith('/dashboard/buddies')) return '/dashboard';
  if (pathname.startsWith('/dashboard/notifications')) return '/dashboard';
  if (pathname.startsWith('/dashboard')) return '/';
  if (pathname.startsWith('/auth')) return '/';
  return '/';
}

function crumbLabel(path: string) {
  return titleForPath(path);
}

export default function AppNavigation({ signedIn, notificationCount }: AppNavigationProps) {
  const { isSignedIn } = useAuth();
  const router = useRouter();
  const pathname = usePathname() || '/';
  const searchParams = useSearchParams();
  const [crumbsOpen, setCrumbsOpen] = useState(false);
  const title = useMemo(() => titleForPath(pathname), [pathname]);
  const stack = useNavStack(pathname);
  const recent = useMemo(() => [...stack].reverse().filter((entry) => entry.path !== pathname).slice(0, 4), [stack, pathname]);
  const canBack = pathname !== '/';
  const q = searchParams.get('q') ?? '';
  const resolvedSignedIn = Boolean(isSignedIn || signedIn);
  const isAuthRoute =
    pathname.startsWith('/sign-in') ||
    pathname.startsWith('/sign-up') ||
    pathname.startsWith('/auth/');

  if (isAuthRoute) return null;

  function goBack() {
    if (!canBack) return router.push('/');
    if (window.history.length > 1) router.back();
    else router.push(fallbackPath(pathname));
  }

  return (
    <>
      <header className="sticky top-0 z-50 border-b bg-white/95 shadow-sm backdrop-blur">
        <nav className="mx-auto flex max-w-6xl items-center gap-3 px-3 py-3 sm:px-6">
          <button
            type="button"
            aria-label="Back"
            onClick={goBack}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border text-2xl font-bold active:bg-slate-100"
          >
            ←
          </button>
          <div className="min-w-0 flex-1">
            <button
              type="button"
              onClick={() => setCrumbsOpen((value) => !value)}
              className="block w-full truncate text-left text-base font-bold text-slate-900"
            >
              {title}
            </button>
            <div className="hidden truncate text-xs text-slate-500 sm:block">{pathname}{q ? `?q=${q}` : ''}</div>
          </div>
          {resolvedSignedIn ? <RealtimeNotificationBell /> : null}
          <AccountActions fallbackSignedIn={resolvedSignedIn} notificationCount={notificationCount} />
        </nav>

        {crumbsOpen ? (
          <div className="mx-auto max-w-6xl border-t bg-white px-3 py-3 sm:px-6">
            <div className="flex justify-start gap-2 overflow-x-auto text-sm font-medium">
              <Link onClick={() => setCrumbsOpen(false)} href="/" className="shrink-0 rounded-full border px-3 py-2">Home</Link>
              {recent.map((entry) => (
                <Link
                  onClick={() => setCrumbsOpen(false)}
                  key={`${entry.path}-${entry.ts}`}
                  href={entry.path}
                  className="shrink-0 rounded-full border px-3 py-2"
                >
                  {crumbLabel(entry.path)}
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        <FeaturesRibbon pathname={pathname} signedIn={resolvedSignedIn} notificationCount={notificationCount} />
      </header>
      <NavStackClient />
    </>
  );
}
