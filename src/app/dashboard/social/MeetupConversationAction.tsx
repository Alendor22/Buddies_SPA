'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function MeetupConversationAction({ eventId, conversationId, attending }: { eventId: string; conversationId: string | null; attending: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function join() {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/social/events', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'join', eventId })
      });
      const data = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? 'Could not join this meetup.');
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not join this meetup.');
    } finally {
      setBusy(false);
    }
  }

  return <div className="mt-4">
    {attending && conversationId
      ? <Link href={`/dashboard/messages?conversation=${encodeURIComponent(conversationId)}`} className="inline-flex rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white">Open meetup chat</Link>
      : <button type="button" disabled={busy} onClick={() => void join()} className="rounded-lg border px-3 py-2 text-sm font-medium disabled:opacity-50">{busy ? 'Joining…' : 'Join meetup'}</button>}
    {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
  </div>;
}
