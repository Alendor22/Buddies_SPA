import Link from 'next/link';
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Buddies',
  description: 'Dog identity, safety, walking, and community network'
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <header className="sticky top-0 z-50 border-b bg-white">
          <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
            <Link href="/" className="font-bold text-slate-900">Buddies</Link>
            <div className="flex gap-2 text-sm font-medium">
              <Link href="/" className="rounded-lg border px-3 py-2">Home</Link>
              <Link href="/dashboard" className="rounded-lg bg-slate-900 px-3 py-2 text-white">Dashboard</Link>
            </div>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
