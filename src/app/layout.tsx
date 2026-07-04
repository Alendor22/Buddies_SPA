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
  return <span className="ml-1 rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white">{count}</span>;
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();
  const notificationCount = user ? await getNotificationCount(user.id) : 0;

  return (
    <html lang="en">
      <body>
        <header className="sticky top-0 z-50 border-b bg-white/95 shadow-sm backdrop-blur">
          <nav className="mx-auto max-w-6xl px-3 py-2 sm:px-6">
            <div className="flex items-center justify-between gap-3">
              <Link href="/" className="shrink-0 rounded-full bg-slate-900 px-3 py-2 text-sm font-bold text-white">Buddies</Link>
              <div className="min-w-0 flex-1 overflow-x-auto">
                <div className="flex w-max items-center gap-2 px-1 text-sm font-medium">
                  <Link href="/" className="rounded-lg border px-3 py-2">Home</Link>
                  <Link href="/dashboard" className="rounded-lg border px-3 py-2">Dashboard</Link>
                  <Link href="/dogs" className="rounded-lg border px-3 py-2">Dogs</Link>
                  <Link href="/dogs/new" className="rounded-lg border px-3 py-2">Add dog</Link>
                  <Link href="/dashboard/buddies" className="rounded-lg border px-3 py-2">Buddies</Link>
                  <Link href="/dashboard/notifications" className="rounded-lg bg-slate-900 px-3 py-2 text-white">Notifications<NavBadge count={notificationCount} /></Link>
                </div>
              </div>
            </div>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
