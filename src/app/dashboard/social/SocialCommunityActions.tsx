'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

type DogOption = { id: string; name: string; breed: string | null; photoUrl: string | null };
type Pack = {
  id: string;
  name: string;
  description: string | null;
  isOwner: boolean;
  formed: boolean;
  acceptedDogs: DogOption[];
  pendingDogs: DogOption[];
  joinRequests: Array<{ dogId: string; dogName: string; requesterName: string }>;
};
type Suggestion = {
  id: string;
  name: string;
  description: string | null;
  memberCount: number;
  ownerName: string;
  reasons: string[];
  dogs: DogOption[];
};
type PackData = {
  ownDogs: DogOption[];
  candidateDogs: DogOption[];
  packs: Pack[];
  invitations: Array<{ packId: string; packName: string; packDescription: string | null; invitedDog: DogOption; invitedBy: string }>;
};

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { 'content-type': 'application/json', ...init?.headers } });
  const body = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? 'The request could not be completed.');
  return body;
}

export default function SocialCommunityActions() {
  const router = useRouter();
  const [data, setData] = useState<PackData | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selectedDogs, setSelectedDogs] = useState<string[]>([]);
  const [selectedPackId, setSelectedPackId] = useState('');
  const [requestDogId, setRequestDogId] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const fetchData = useCallback(async () => Promise.all([
      requestJson<PackData>('/api/social/packs'),
      requestJson<{ suggestions: Suggestion[] }>('/api/social/packs/suggestions')
  ] as const), []);

  const refresh = useCallback(async () => {
    const [packData, suggestionData] = await fetchData();
    setData(packData);
    setSuggestions(suggestionData.suggestions);
    setSelectedPackId((current) => current || packData.packs.find((pack) => pack.formed)?.id || '');
    setRequestDogId((current) => current || packData.ownDogs[0]?.id || '');
  }, [fetchData]);

  useEffect(() => {
    let cancelled = false;
    void fetchData().then(([packData, suggestionData]) => {
      if (cancelled) return;
      setData(packData);
      setSuggestions(suggestionData.suggestions);
      setSelectedPackId((current) => current || packData.packs.find((pack) => pack.formed)?.id || '');
      setRequestDogId((current) => current || packData.ownDogs[0]?.id || '');
    }).catch((reason: unknown) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : 'Could not load packs.');
    });
    return () => { cancelled = true; };
  }, [fetchData]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await action();
      await refresh();
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The request could not be completed.');
    } finally {
      setBusy(false);
    }
  }

  async function createPack(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    await run(async () => {
      const result = await requestJson<{ packId: string; message: string }>('/api/social/packs', {
        method: 'POST', body: JSON.stringify({ action: 'create', name: form.get('name'), description: form.get('description'), dogId: form.get('dogId') })
      });
      setSelectedPackId('');
      setMessage(result.message);
      formElement.reset();
    });
  }

  async function inviteDogs(event: FormEvent<HTMLFormElement>, packId: string) {
    event.preventDefault();
    await run(async () => {
      const result = await requestJson<{ invited: number }>('/api/social/packs', {
        method: 'POST', body: JSON.stringify({ action: 'invite', packId, dogIds: selectedDogs })
      });
      setSelectedDogs([]);
      setMessage(`Sent ${result.invited} pack invitation${result.invited === 1 ? '' : 's'}.`);
    });
  }

  async function respond(packId: string, dogId: string, decision: 'accept' | 'decline') {
    await run(async () => {
      await requestJson('/api/social/packs', { method: 'POST', body: JSON.stringify({ action: 'respond', packId, dogId, decision }) });
      setMessage(decision === 'accept' ? 'Pack invitation accepted.' : 'Pack invitation declined.');
    });
  }

  async function reviewRequest(packId: string, dogId: string, decision: 'accept' | 'decline') {
    await run(async () => {
      await requestJson('/api/social/packs', { method: 'POST', body: JSON.stringify({ action: 'request-response', packId, dogId, decision }) });
      setMessage(decision === 'accept' ? 'Dog added to the pack.' : 'Join request declined.');
    });
  }

  async function requestToJoin(packId: string) {
    const dogId = requestDogId;
    if (!dogId) return setError('Create a safe dog profile before requesting to join a pack.');
    await run(async () => {
      await requestJson('/api/social/packs', { method: 'POST', body: JSON.stringify({ action: 'request', packId, dogId }) });
      setMessage('Join request sent to the pack creator.');
    });
  }

  async function createEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const startsAt = new Date(String(form.get('startsAt')));
    if (Number.isNaN(startsAt.getTime())) return setError('Choose a valid meetup date and time.');
    await run(async () => {
      await requestJson('/api/social/events', {
        method: 'POST',
        body: JSON.stringify({ title: form.get('title'), description: form.get('description'), locationName: form.get('locationName'), startsAt: startsAt.toISOString(), packId: form.get('packId') || null })
      });
      setMessage('Meetup created. You are listed as attending.');
      formElement.reset();
    });
  }

  return (
    <section className="mt-8 grid gap-6 lg:grid-cols-2" aria-labelledby="community-actions-title">
      <h2 id="community-actions-title" className="sr-only">Packs and meetups</h2>
      <div className="space-y-6">
        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Create a pack</h2>
          <p className="mt-1 text-sm text-slate-600">Start with a dog you manage, then invite buddy dogs. A pack is formed when at least three dogs accept.</p>
          <form onSubmit={createPack} className="mt-4 grid gap-3">
            <label className="grid gap-1 text-sm font-medium">Pack name<input required name="name" maxLength={80} className="rounded-lg border px-3 py-2 font-normal" /></label>
            <label className="grid gap-1 text-sm font-medium">Description<textarea name="description" maxLength={500} rows={2} className="rounded-lg border px-3 py-2 font-normal" /></label>
            <label className="grid gap-1 text-sm font-medium">Start with your dog<select required name="dogId" className="rounded-lg border px-3 py-2 font-normal" defaultValue="">
              <option value="" disabled>Select a dog</option>{data?.ownDogs.map((dog) => <option key={dog.id} value={dog.id}>{dog.name}</option>)}
            </select></label>
            <button disabled={busy || !data?.ownDogs.length} className="w-fit rounded-lg bg-slate-900 px-4 py-2 font-medium text-white disabled:opacity-50">Create pack</button>
            {!data?.ownDogs.length && <p className="text-sm text-amber-800">Add a safe dog profile before creating a pack.</p>}
          </form>
        </section>

        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Your packs</h2>
          <div className="mt-4 space-y-4">
            {data?.packs.length ? data.packs.map((pack) => (
              <article key={pack.id} className="rounded-xl border p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div><h3 className="font-semibold">{pack.name}</h3><p className="mt-1 text-sm text-slate-600">{pack.acceptedDogs.length} accepted dog{pack.acceptedDogs.length === 1 ? '' : 's'} · {pack.formed ? 'Formed' : 'Forming (needs 3)'}</p></div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${pack.formed ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'}`}>{pack.formed ? 'ACTIVE' : 'FORMING'}</span>
                </div>
                <p className="mt-3 text-sm text-slate-700">{pack.acceptedDogs.map((dog) => dog.name).join(', ')}</p>
                {pack.isOwner && data?.candidateDogs.length > 0 && <form onSubmit={(event) => void inviteDogs(event, pack.id)} className="mt-4 border-t pt-4">
                  <p className="text-sm font-medium">Invite dog buddies</p>
                  <div className="mt-2 grid max-h-36 gap-2 overflow-y-auto sm:grid-cols-2">
                    {data.candidateDogs.filter((dog) => !pack.acceptedDogs.some((member) => member.id === dog.id) && !pack.pendingDogs.some((member) => member.id === dog.id)).map((dog) => (
                      <label key={dog.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={selectedDogs.includes(dog.id)} onChange={(event) => setSelectedDogs((current) => event.target.checked ? [...current, dog.id] : current.filter((id) => id !== dog.id))} />{dog.name}{dog.breed ? ` · ${dog.breed}` : ''}</label>
                    ))}
                  </div>
                  <button disabled={busy || selectedDogs.length === 0} className="mt-3 rounded-lg border px-3 py-2 text-sm font-medium disabled:opacity-50">Send invitations</button>
                </form>}
                {pack.isOwner && pack.joinRequests.length > 0 && <div className="mt-4 border-t pt-4"><p className="text-sm font-medium">Requests to join</p>{pack.joinRequests.map((request) => <div key={request.dogId} className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm"><span>{request.dogName} · {request.requesterName}</span><span className="flex gap-2"><button disabled={busy} onClick={() => void reviewRequest(pack.id, request.dogId, 'accept')} className="rounded border px-2 py-1">Accept</button><button disabled={busy} onClick={() => void reviewRequest(pack.id, request.dogId, 'decline')} className="rounded border px-2 py-1">Decline</button></span></div>)}</div>}
              </article>
            )) : <p className="text-sm text-slate-600">No packs yet. Start one and invite dogs you already know through Buddies.</p>}
          </div>
        </section>

        {data?.invitations.length ? <section className="rounded-2xl border bg-white p-6 shadow-sm"><h2 className="text-xl font-semibold">Pack invitations</h2>{data.invitations.map((invite) => <article key={`${invite.packId}-${invite.invitedDog.id}`} className="mt-3 rounded-xl border p-4"><p><strong>{invite.packName}</strong> invited {invite.invitedDog.name}</p><p className="mt-1 text-sm text-slate-600">From {invite.invitedBy}</p><div className="mt-3 flex gap-2"><button disabled={busy} onClick={() => void respond(invite.packId, invite.invitedDog.id, 'accept')} className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white">Accept</button><button disabled={busy} onClick={() => void respond(invite.packId, invite.invitedDog.id, 'decline')} className="rounded-lg border px-3 py-2 text-sm">Decline</button></div></article>)}</section> : null}
      </div>

      <div className="space-y-6">
        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Suggested packs</h2>
          <p className="mt-1 text-sm text-slate-600">Suggestions use shared routes, coarse active walking areas, breed, and dog-friendly preferences. Exact live locations are never shown.</p>
          {data?.ownDogs.length ? <label className="mt-3 grid max-w-sm gap-1 text-sm font-medium">Dog to include in your request<select value={requestDogId} onChange={(event) => setRequestDogId(event.target.value)} className="rounded-lg border px-3 py-2 font-normal">{data.ownDogs.map((dog) => <option key={dog.id} value={dog.id}>{dog.name}</option>)}</select></label> : null}
          <div className="mt-4 space-y-3">
            {suggestions.length ? suggestions.map((pack) => <article key={pack.id} className="rounded-xl border p-4">
              <div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">{pack.name}</h3><p className="mt-1 text-sm text-slate-500">{pack.memberCount} dogs · organized by {pack.ownerName}</p></div><button disabled={busy || !data?.ownDogs.length} onClick={() => void requestToJoin(pack.id)} className="shrink-0 rounded-lg border px-3 py-2 text-sm font-medium disabled:opacity-50">Request to join</button></div>
              <p className="mt-3 text-sm text-slate-700">{pack.reasons.join(' · ')}</p><p className="mt-1 text-xs text-slate-500">{pack.dogs.map((dog) => dog.name).join(', ')}</p>
            </article>) : <p className="text-sm text-slate-600">No pack suggestions yet. Recommendations appear as nearby packs form and shared walking history becomes available.</p>}
          </div>
        </section>

        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Create a meetup</h2>
          <p className="mt-1 text-sm text-slate-600">Schedule a neighborhood walk, park meetup, or pack event.</p>
          <form onSubmit={createEvent} className="mt-4 grid gap-3">
            <label className="grid gap-1 text-sm font-medium">Title<input required name="title" maxLength={120} className="rounded-lg border px-3 py-2 font-normal" /></label>
            <label className="grid gap-1 text-sm font-medium">Date and time<input required type="datetime-local" name="startsAt" className="rounded-lg border px-3 py-2 font-normal" /></label>
            <label className="grid gap-1 text-sm font-medium">Meeting place<input name="locationName" maxLength={160} placeholder="Park or public meeting point" className="rounded-lg border px-3 py-2 font-normal" /></label>
            <label className="grid gap-1 text-sm font-medium">Pack (optional)<select name="packId" value={selectedPackId} onChange={(event) => setSelectedPackId(event.target.value)} className="rounded-lg border px-3 py-2 font-normal"><option value="">Open community meetup</option>{data?.packs.filter((pack) => pack.formed).map((pack) => <option key={pack.id} value={pack.id}>{pack.name}</option>)}</select></label>
            <label className="grid gap-1 text-sm font-medium">Details<textarea name="description" maxLength={1000} rows={3} className="rounded-lg border px-3 py-2 font-normal" /></label>
            <button disabled={busy} className="w-fit rounded-lg bg-slate-900 px-4 py-2 font-medium text-white disabled:opacity-50">Create meetup</button>
          </form>
        </section>
      </div>
      <div aria-live="polite" className="lg:col-span-2">{error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}{message && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}</div>
    </section>
  );
}
