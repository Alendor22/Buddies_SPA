import { ClerkProvider } from '@clerk/nextjs';
import type { Metadata } from 'next';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Analytics } from '@vercel/analytics/next';
import AppNavigation from '@/components/AppNavigation';
import { MapboxProvider } from '@/components/providers/MapboxProvider';
import { getClerkPublishableKey } from '@/lib/clerkConfig';
import { getPublicMapboxToken } from '@/lib/mapboxToken';
import './globals.css';

export const metadata: Metadata = {
  title: 'Buddies',
  description: 'Dog identity, safety, walking, and community network'
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
