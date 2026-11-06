import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { enabled } from '@/lib/meta/security';
import MetaControls from '@/components/MetaControls';

export const dynamic = 'force-dynamic';
export default async function MetaSettingsPage() {
  if (!enabled()) notFound();
  const user = await getCurrentUser();
  if (!user) redirect('/sign-in');
  const [dogs, walks, events] = (enabled('SHARING') || enabled('MESSAGING')) ? await Promise.all([
    prisma.dog.findMany({ where: { ownerId: user.id }, select: { id: true, name: true }, take: 100 }),
    prisma.walk.findMany({ where: { dog: { ownerId: user.id } }, select: { id: true, dog: { select: { name: true } } }, take: 100, orderBy: { startsAt: 'desc' } }),
    prisma.socialEvent.findMany({ where: { hostId: user.id, visibility: 'PUBLIC', OR: [{ groupId: null }, { group: { visibility: 'PUBLIC' } }] }, select: { id: true, title: true }, take: 100 })
  ]) : [[], [], []];
  return <main className="mx-auto max-w-3xl space-y-6 p-6">
    <Link href="/dashboard/account">Back to account</Link>
    <h1 className="text-3xl font-bold">Meta connections and sharing</h1>
    <p>Facebook sign-in is managed in your Clerk account. Business connections below authorize access to Pages, Instagram professional accounts and WhatsApp business numbers separately.</p>
    <MetaControls sharing={enabled('SHARING')} connectionsEnabled={enabled('CONNECTIONS')} messaging={enabled('MESSAGING')} resources={[
      ...dogs.map(dog => ({ id: dog.id, kind: 'profile' as const, label: dog.name })),
      ...walks.map(walk => ({ id: walk.id, kind: 'walk' as const, label: `Walk with ${walk.dog.name}` })),
      ...events.map(event => ({ id: event.id, kind: 'event' as const, label: event.title }))
    ]} />
  </main>;
}
