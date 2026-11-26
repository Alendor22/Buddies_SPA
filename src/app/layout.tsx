import { ClerkProvider } from '@clerk/nextjs';
import type { Metadata } from 'next';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Analytics } from '@vercel/analytics/next';
import AppNavigation from '@/components/AppNavigation';
import { MapboxProvider } from '@/components/providers/MapboxProvider';
import { getClerkPublishableKey } from '@/lib/clerkConfig';
import { getPublicMapboxToken } from '@/lib/mapboxToken';
import './globals.css';

const appIcon = '/icons/icon-512.png';

export const metadata: Metadata = {
  title: 'Buddies',
  description: 'Dog identity, safety, walking, and community network',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [{ url: '/icon.png', type: 'image/png', sizes: '512x512' }],
    shortcut: ['/icon.png'],
    apple: [{ url: '/apple-icon.png', type: 'image/png', sizes: '180x180' }]
  },
  openGraph: {
    type: 'website',
    siteName: 'Buddies',
    title: 'Buddies',
    description: 'Dog identity, safety, walking, and community network',
    images: [{ url: appIcon, width: 512, height: 512, alt: 'Buddies app icon' }]
  },
  twitter: {
    card: 'summary',
    title: 'Buddies',
    description: 'Dog identity, safety, walking, and community network',
    images: [appIcon]
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const mapboxToken = getPublicMapboxToken();
  const clerkPublishableKey = getClerkPublishableKey();

  return (
    <ClerkProvider
      dynamic
      publishableKey={clerkPublishableKey}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/dashboard"
      signUpFallbackRedirectUrl="/dashboard"
    >
      <html lang="en">
        <body className="pb-24 sm:pb-0">
          <MapboxProvider initialToken={mapboxToken}>
            <AppNavigation signedIn={false} initial="A" notificationCount={0} />
            {children}
          </MapboxProvider>
          <Analytics />
        </body>
      </html>
    </ClerkProvider>
  );
}
