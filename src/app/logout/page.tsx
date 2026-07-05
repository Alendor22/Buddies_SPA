import Link from 'next/link';
import LogoutClient from '@/components/LogoutClient';

export const dynamic = 'force-dynamic';

export default function LogoutPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <LogoutClient />
      <p className="text-sm font-medium text-slate-500">Buddies V2.3 Static Logout</p>
      <h1 className="mt-2 text-3xl font-bold">Signed out</h1>
      <p className="mt-3 text-slate-600">Your Buddies session is being cleared on this device. Use Sign in again to start a new session.</p>
      <Link href="/auth/login?fresh=1" className="mt-6 rounded-lg bg-slate-900 px-5 py-3 text-center font-medium text-white">Sign in again</Link>
      <Link href="/" className="mt-3 rounded-lg border px-5 py-3 text-center font-medium">Go home</Link>
    </main>
  );
}
