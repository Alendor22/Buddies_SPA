import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import WalkMessageThread from '@/components/WalkMessageThread';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getWalkAccess } from '@/lib/walkAccess';

export const dynamic = 'force-dynamic';

export default async function WalkMessagesPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/login');

  const { id: walkId } = await params;
  const access = await getWalkAccess(walkId, user.id);
  if (!access) notFound();

  const messages = (await prisma.message.findMany({
    where: { walkId },
    orderBy: { createdAt: 'desc' },
    take: 100
  })).reverse();

  const initialMessages = messages.map((message) => ({
    id: message.id,
    senderId: message.senderId,
    senderLabel: access.labels.get(message.senderId) ?? 'Walk participant',
    body: message.body,
    createdAt: message.createdAt.toISOString()
  }));

  const participantNames = Array.from(new Set(access.labels.values()));

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">Buddies Phase 2 Realtime Messaging</p>
          <h1 className="mt-1 text-3xl font-bold">{access.walk.dog.name} walk chat</h1>
          <p className="mt-2 text-sm text-slate-600">{access.walk.startsAt.toLocaleString()} · {access.walk.durationMin} min · {access.walk.status}</p>
          <p className="mt-1 text-sm text-slate-600">Dog participants: {participantNames.join(', ') || access.walk.dog.name}</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/dogs/${access.walk.dog.slug}`} className="rounded-lg border px-4 py-2 text-sm font-medium">Dog profile</Link>
          <Link href="/dashboard/walks" className="rounded-lg border px-4 py-2 text-sm font-medium">Walks</Link>
        </div>
      </div>

      <WalkMessageThread
        walkId={walkId}
        currentUserId={user.id}
        currentLabel={access.currentLabel}
        initialMessages={initialMessages}
      />
    </main>
  );
}
