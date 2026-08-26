import type { Metadata } from 'next';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Analytics } from '@vercel/analytics/next';
import AppNavigation from '@/components/AppNavigation';
import { MapboxProvider } from '@/components/providers/MapboxProvider';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import './globals.css';

export const metadata: Metadata = {
  title: 'Buddies',
  description: 'Dog identity, safety, walking, and community network'
};

async function getNotificationCount(userId: string) {
  return prisma.notification.count({ where: { userId, readAt: null } }).catch(() => 0);
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();
  const notificationCount = user ? await getNotificationCount(user.id) : 0;
  const initial = user?.displayName?.slice(0, 1).toUpperCase() ?? 'A';

  return (
    <html lang="en">
      <body className="pb-24 sm:pb-0">
        <MapboxProvider>
          <AppNavigation signedIn={Boolean(user)} initial={initial} notificationCount={notificationCount} />
          {children}
        </MapboxProvider>
        <Analytics />
      </body>
    </html>
  );
}
