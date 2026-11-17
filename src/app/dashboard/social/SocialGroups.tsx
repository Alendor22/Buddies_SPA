'use client';

import { useCallback, useEffect, useState } from 'react';

type Group = { id: string; name: string; description: string | null; city: string | null; joined: boolean };

export default function SocialGroups() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');

  const refresh = useCallback(async () => {
    const response = await fetch('/api/social/groups', { cache: 'no-store' });
    const result = await response.json() as { groups?: Group[]; error?: string };
    if (!response.ok) throw new Error(result.error ?? 'Could not load public groups.');
    setGroups(result.groups ?? []);
  }, []);

  useEffect(() => {
    void refresh().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Could not load public groups.'));
  }, [refresh]);

  async function toggle(group: Group) {
    setBusyId(group.id);
    setError('');
    try {
      const response = await fetch('/api/social/groups', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: group.joined ? 'leave' : 'join', groupId: group.id })
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? 'Could not update your group subscription.');
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not update your group subscription.');
    } finally {
      setBusyId('');
    }
  }

  return (
    <section className="mt-8 rounded-2xl border bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold">Public community groups</h2>
      <p className="mt-1 text-sm text-slate-600">Subscribe to groups to see their activity in your feed. Group participation is open without dog-buddy connections.</p>
      {error ? <p role="alert" className="mt-3 text-sm text-red-700">{error}</p> : null}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {groups.length ? groups.map((group) => (
          <article key={group.id} className="rounded-xl border p-4">
            <div className="flex items-start justify-between gap-3">
              <div><h3 className="font-semibold">{group.name}</h3>{group.city ? <p className="text-xs text-slate-500">{group.city}</p> : null}</div>
              <button type="button" disabled={busyId === group.id} onClick={() => void toggle(group)} className="shrink-0 rounded-lg border px-3 py-2 text-sm font-medium disabled:opacity-50">
                {busyId === group.id ? 'Saving…' : group.joined ? 'Unsubscribe' : 'Subscribe'}
              </button>
            </div>
            {group.description ? <p className="mt-2 text-sm text-slate-600">{group.description}</p> : null}
          </article>
        )) : <p className="text-sm text-slate-600">No public groups are available yet.</p>}
      </div>
    </section>
  );
}
