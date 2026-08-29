import LogoutClient from '@/components/LogoutClient';

export const dynamic = 'force-dynamic';

export default function LogoutPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 py-12 text-center">
      <h1 className="text-3xl font-bold">Signing out</h1>
      <div className="mt-3"><LogoutClient /></div>
    </main>
  );
}
