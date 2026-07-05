import Link from 'next/link';
import type { Metadata } from 'next';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import './globals.css';

export const metadata: Metadata = {
  title: 'Buddies',
  description: 'Dog identity, safety, walking, and community network'
};

async function getNotificationCount(userId: string) {
  const [incomingRequests, safetyAlerts] = await Promise.all([
    prisma.buddyRequest.count({ where: { receiverId: userId, status: 'PENDING' } }),
    prisma.dog.count({ where: { ownerId: userId, NOT: { status: 'SAFE' } } })
  ]).catch(() => [0, 0]);

  return incomingRequests + safetyAlerts;
}

function NavBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red-600 px-1.5 py-0.5 text-center text-[10px] font-bold leading-none text-white">{count}</span>;
}

function NavItem({ href, icon, label, count }: { href: string; icon: string; label: string; count?: number }) {
  return (
    <Link href={href} className="relative flex min-w-[56px] flex-col items-center justify-center gap-1 rounded-xl px-1.5 py-2 text-xs font-semibold text-slate-700 active:bg-slate-100">
      <span className="text-xl leading-none" aria-hidden="true">{icon}</span>
      <span className="leading-none">{label}</span>
      <NavBadge count={count ?? 0} />
    </Link>
  );
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();
  const notificationCount = user ? await getNotificationCount(user.id) : 0;
  const initial = user?.displayName?.slice(0, 1).toUpperCase() ?? 'A';

  return (
    <html lang="en">
      <body className="pb-24 sm:pb-0">
        <header className="sticky top-0 z-50 border-b bg-white/95 shadow-sm backdrop-blur">
          <nav className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <Link href="/" className="rounded-full bg-slate-900 px-4 py-2 text-sm font-bold text-white">Buddies</Link>
            <div className="flex items-center gap-2">
              {user ? (
                <Link href="/dashboard/account" className="flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-xs text-white">{initial}</span>
                  <span className="hidden sm:inline">Account</span>
                </Link>
              ) : (
                <Link href="/auth/login" className="rounded-lg border px-3 py-2 text-sm font-semibold">Sign in</Link>
              )}
            </div>
            <div className="hidden items-center gap-2 text-sm font-medium sm:flex">
              <Link href="/dashboard" className="rounded-lg border px-3 py-2">Dashboard</Link>
              <Link href="/dogs" className="rounded-lg border px-3 py-2">Dogs</Link>
              <Link href="/dogs/new" className="rounded-lg border px-3 py-2">Add Dog</Link>
              <Link href="/dashboard/buddies" className="rounded-lg border px-3 py-2">Buddies</Link>
              <Link href="/dashboard/notifications" className="relative rounded-lg bg-slate-900 px-3 py-2 text-white">Notifications<NavBadge count={notificationCount} /></Link>
            </div>
          </nav>
        </header>

        {children}

        <nav className="fixed inset-x-0 bottom-0 z-50 border-t bg-white/95 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur sm:hidden">
          <div className="mx-auto grid max-w-md grid-cols-6 gap-1 px-1 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2">
            <NavItem href="/" icon="⌂" label="Home" />
            <NavItem href="/dashboard" icon="▦" label="Dash" />
            <NavItem href="/dogs" icon="🐶" label="Dogs" />
            <NavItem href="/dogs/new" icon="＋" label="Add" />
            <NavItem href="/dashboard/notifications" icon="🔔" label="Alerts" count={notificationCount} />
            <NavItem href={user ? '/dashboard/account' : '/auth/login'} icon="👤" label={user ? 'Acct' : 'Login'} />
          </div>
        </nav>
      </body>
    </html>
  );
}
