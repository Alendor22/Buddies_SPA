'use client';

import { SignedIn, SignedOut, UserButton } from '@clerk/nextjs';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import NavStackClient, { useNavStack } from '@/components/NavStackClient';

type AppNavigationProps = { signedIn: boolean; initial: string; notificationCount: number };

function Badge({ count }: { count: number }) {
  if (count <= 0) return null;
  return <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red-600 px-1.5 py-0.5 text-center text-[10px] font-bold leading-none text-white">{count}</span>;
}

function titleForPath(pathname: string) {
  if (pathname === '/') return 'Home';
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
  if (pathname.startsWith('/sign-in') || pathname.startsWith('/auth/login')) return 'Sign in';
  if (pathname.startsWith('/sign-up') || pathname.startsWith('/auth/register')) return 'Create account';
  if (pathname.startsWith('/logout')) return 'Signed out';
  return 'Buddies';
}

function fallbackPath(pathname: string) {
  if (pathname.startsWith('/dogs/new') || pathname.startsWith('/dogs/edit') || pathname.startsWith('/dogs/')) return '/dogs';
  if (pathname.startsWith('/dashboard/check-ins')) return '/dashboard/buddies';
  if (pathname.startsWith('/dashboard/messages')) return '/dashboard/walks';
  if (pathname.includes('/dashboard/walks/') && pathname.endsWith('/messages')) return '/dashboard/messages';
  if (pathname.startsWith('/dashboard/walks')) return '/dashboard/buddies';
  if (pathname.startsWith('/dashboard/lost')) return '/dashboard/notifications';
  if (pathname.startsWith('/dashboard/buddies')) return '/dashboard';
  if (pathname.startsWith('/dashboard/notifications')) return '/dashboard';
  if (pathname.startsWith('/dashboard')) return '/';
  if (pathname.startsWith('/auth')) return '/';
  return '/';
}

function Tab({ href, icon, label, active, count }: { href: string; icon: string; label: string; active: boolean; count?: number }) {
  return <Link href={href} className={`relative flex min-w-[56px] flex-col items-center justify-center gap-1 rounded-xl px-1.5 py-2 text-xs font-semibold active:bg-slate-100 ${active ? 'text-slate-950' : 'text-slate-600'}`}><span className="text-xl leading-none" aria-hidden="true">{icon}</span><span className="leading-none">{label}</span><Badge count={count ?? 0} /></Link>;
}

function crumbLabel(path: string) { return titleForPath(path); }

export default function AppNavigation({ signedIn, initial, notificationCount }: AppNavigationProps) {
  const router = useRouter();
  const pathname = usePathname() || '/';
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [crumbsOpen, setCrumbsOpen] = useState(false);
  const title = useMemo(() => titleForPath(pathname), [pathname]);
  const accountHref = signedIn ? '/dashboard/menu' : '/sign-in';
  const stack = useNavStack(pathname);
  const recent = useMemo(() => [...stack].reverse().filter((entry) => entry.path !== pathname).slice(0, 4), [stack, pathname]);
  const canBack = pathname !== '/';
  const q = searchParams.get('q') ?? '';
  const isAuthRoute =
    pathname.startsWith('/sign-in') ||
    pathname.startsWith('/sign-up') ||
    pathname.startsWith('/auth/');

  if (isAuthRoute) return null;

  function goBack() { if (!canBack) return router.push('/'); if (window.history.length > 1) router.back(); else router.push(fallbackPath(pathname)); }

  return (
    <>
      <header className="sticky top-0 z-50 border-b bg-white/95 shadow-sm backdrop-blur"><nav className="mx-auto flex max-w-6xl items-center gap-3 px-3 py-3 sm:px-6"><button type="button" aria-label="Back" onClick={goBack} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border text-2xl font-bold active:bg-slate-100">←</button><div className="min-w-0 flex-1"><button type="button" onClick={() => setCrumbsOpen((value) => !value)} className="block w-full truncate text-center text-base font-bold text-slate-900 sm:text-left">{title}</button><div className="hidden truncate text-xs text-slate-500 sm:block">{pathname}{q ? `?q=${q}` : ''}</div></div><Link href="/dashboard/buddies" className="hidden h-10 w-10 items-center justify-center rounded-full border text-lg sm:flex" aria-label="Search dogs">⌕</Link><SignedIn><div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border" aria-label="Account"><UserButton /><Badge count={notificationCount} /></div></SignedIn><SignedOut><Link href={accountHref} className="flex h-11 shrink-0 items-center justify-center rounded-full border px-3 text-xs font-bold" aria-label="Sign in">Sign in</Link></SignedOut></nav>{crumbsOpen ? <div className="mx-auto max-w-6xl border-t bg-white px-4 py-3 sm:px-6"><div className="flex gap-2 overflow-x-auto text-sm font-medium"><Link onClick={() => setCrumbsOpen(false)} href="/" className="shrink-0 rounded-full border px-3 py-2">Home</Link>{recent.map((entry) => <Link onClick={() => setCrumbsOpen(false)} key={`${entry.path}-${entry.ts}`} href={entry.path} className="shrink-0 rounded-full border px-3 py-2">{crumbLabel(entry.path)}</Link>)}</div></div> : null}</header>
      <NavStackClient />
      <button type="button" aria-label="Quick actions" onClick={() => setOpen((value) => !value)} className="fixed bottom-24 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-3xl font-semibold text-white shadow-xl sm:hidden">+</button>
      {open ? <div className="fixed inset-x-4 bottom-40 z-50 rounded-2xl border bg-white p-4 shadow-2xl sm:hidden"><div className="grid gap-2 text-sm font-semibold"><Link onClick={() => setOpen(false)} href="/dogs/new" className="rounded-xl border px-4 py-3">Add Profile</Link><Link onClick={() => setOpen(false)} href="/dashboard/buddies/invite" className="rounded-xl border px-4 py-3">Invite Buddy</Link><Link onClick={() => setOpen(false)} href="/dashboard/buddies" className="rounded-xl border px-4 py-3">Dog Search</Link><Link onClick={() => setOpen(false)} href="/dashboard/check-ins" className="rounded-xl border px-4 py-3">Dog Check-ins</Link><Link onClick={() => setOpen(false)} href="/dashboard/walks/new" className="rounded-xl border px-4 py-3">Create Walk</Link><Link onClick={() => setOpen(false)} href="/dashboard/messages" className="rounded-xl border px-4 py-3">Messages</Link><Link onClick={() => setOpen(false)} href="/dashboard/lost/report" className="rounded-xl border px-4 py-3">Report Lost Dog</Link><Link onClick={() => setOpen(false)} href="/dashboard/notifications" className="rounded-xl border px-4 py-3">Emergency Alert</Link></div></div> : null}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-white/95 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur sm:hidden"><div className="mx-auto grid max-w-md grid-cols-5 gap-1 px-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2"><Tab href="/" icon="⌂" label="Home" active={pathname === '/'} /><Tab href="/dashboard" icon="▦" label="Dash" active={pathname.startsWith('/dashboard') && !pathname.startsWith('/dashboard/buddies') && !pathname.startsWith('/dashboard/check-ins') && !pathname.startsWith('/dashboard/messages') && !pathname.startsWith('/dashboard/notifications') && !pathname.startsWith('/dashboard/walks') && !pathname.startsWith('/dashboard/lost')} /><Tab href="/dogs" icon="🐶" label="Profiles" active={pathname.startsWith('/dogs')} /><Tab href="/dashboard/buddies" icon="👥" label="Buddies" active={pathname.startsWith('/dashboard/buddies') || pathname.startsWith('/dashboard/check-ins') || pathname.startsWith('/dashboard/walks') || pathname.startsWith('/dashboard/messages')} count={notificationCount} /><Tab href="/dashboard/notifications" icon="🔔" label="Alerts" active={pathname.startsWith('/dashboard/notifications') || pathname.startsWith('/dashboard/lost')} count={notificationCount} /></div></nav>
    </>
  );
}
