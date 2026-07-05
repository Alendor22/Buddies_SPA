import Link from 'next/link';
import { SESSION_COOKIE } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default function SignedOutPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <p className="text-sm font-medium text-slate-500">Buddies V2.3 Logout Fix</p>
      <h1 className="mt-2 text-3xl font-bold">Signed out</h1>
      <p className="mt-3 text-slate-600">Your native Buddies session has been cleared on this device.</p>
      <script dangerouslySetInnerHTML={{ __html: `document.cookie='${SESSION_COOKIE}=; Max-Age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax; Secure'; document.cookie='${SESSION_COOKIE}=; Max-Age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax';` }} />
      <Link href="/auth/login" className="mt-6 rounded-lg bg-slate-900 px-5 py-3 text-center font-medium text-white">Sign in again</Link>
      <Link href="/" className="mt-3 rounded-lg border px-5 py-3 text-center font-medium">Go home</Link>
    </main>
  );
}
