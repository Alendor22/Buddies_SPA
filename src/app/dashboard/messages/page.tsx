import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { UI_ROUTES } from '@/lib/uiRoutes';
import SocialMessagesClient from '@/components/social/SocialMessagesClient';

export const dynamic = 'force-dynamic';

export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ search?: string }> }) {
  const [{ search = '' }, user] = await Promise.all([searchParams, getCurrentUser()]);
  if (!user) redirect('/auth/login');
  const dogs = await prisma.dog.findMany({ where: { ownerId: user.id }, select: { id: true, name: true, ownerId: true, photoUrl: true, breed: true }, orderBy: { name: 'asc' } });

  return <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-sm font-medium text-slate-500">Buddies Messaging</p><h1 className="mt-1 text-3xl font-bold">Messages</h1><p className="mt-2 text-slate-600">Direct dog-to-dog conversations with persisted history and realtime synchronization.</p></div>
      <div className="flex gap-2"><Link href={UI_ROUTES.buddies} className="rounded-lg border px-4 py-2">Buddies</Link><Link href={UI_ROUTES.dashboard} className="rounded-lg border px-4 py-2">Dashboard</Link></div>
    </div>
    {dogs.length === 0 ? <section className="mt-8 rounded-2xl border bg-white p-6"><h2 className="font-semibold">Create a dog profile first</h2><p className="mt-2 text-slate-600">Messages are authored by one of your dog profiles.</p><Link href={UI_ROUTES.profiles} className="mt-4 inline-block rounded-lg bg-slate-900 px-4 py-2 text-white">Dogs</Link></section> : <SocialMessagesClient userId={user.id} dogs={dogs} initialSearch={search} />}
  </main>;
}
