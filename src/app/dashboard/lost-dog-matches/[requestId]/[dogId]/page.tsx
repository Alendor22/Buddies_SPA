import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { getMatchForViewer } from '@/lib/recognition/matches';
import { RecognitionAuthorizationError, RecognitionStateError } from '@/lib/recognition/service';
import { UI_ROUTES } from '@/lib/uiRoutes';
import MatchThreadClient from '@/components/recognition/MatchThreadClient';

export const dynamic = 'force-dynamic';

async function loadMatch(requestId: string, dogId: string, userId: string) {
  try {
    return await getMatchForViewer({ requestId, dogId, userId });
  } catch (error) {
    if (error instanceof RecognitionAuthorizationError || error instanceof RecognitionStateError) return null;
    throw error;
  }
}

export default async function LostDogMatchPage({
  params
}: {
  params: Promise<{ requestId: string; dogId: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/login');
  const { requestId, dogId } = await params;

  const raw = await loadMatch(requestId, dogId, user.id);
  if (!raw) notFound();

  const match = {
    ...raw,
    matchedAt: raw.matchedAt.toISOString(),
    photoExpiresAt: raw.photoExpiresAt ? raw.photoExpiresAt.toISOString() : null
  };

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">Buddies Lost Dog Match</p>
          <h1 className="mt-1 text-2xl font-bold">
            {match.role === 'owner' ? `Possible match for ${match.dog.name}` : `Your report for ${match.dog.name}`}
          </h1>
        </div>
        <Link href={UI_ROUTES.dashboard} className="rounded-lg border px-4 py-2">Dashboard</Link>
      </div>
      <MatchThreadClient requestId={requestId} dogId={dogId} viewerId={user.id} initialMatch={match} />
    </main>
  );
}
