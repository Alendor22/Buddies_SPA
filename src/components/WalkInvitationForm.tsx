'use client';

import { FormEvent } from 'react';

type DogOption = { id: string; name: string };
type Connection = { id: string; myDog: DogOption; otherDog: DogOption };

export default function WalkInvitationForm({ connections }: { connections: Connection[] }) {
  function submit(event: FormEvent<HTMLFormElement>) {
    const form = event.currentTarget;
    const localTime = form.elements.namedItem('startsAtLocal');
    const startsAt = form.elements.namedItem('startsAt');

    if (!(localTime instanceof HTMLInputElement) || !(startsAt instanceof HTMLInputElement) || !localTime.value) {
      return;
    }

    const instant = new Date(localTime.value);
    if (!Number.isNaN(instant.getTime())) {
      startsAt.value = instant.toISOString();
    }
  }

  return (
    <form action="/api/buddies/walk-invite" method="post" onSubmit={submit} className="grid gap-3">
      <label className="grid gap-2 text-sm font-medium">
        Dog buddy pair
        <select name="connection" required className="rounded-lg border px-3 py-3 text-base">
          <option value="">Select connection</option>
          {connections.map((connection) => (
            <option key={connection.id} value={`${connection.myDog.id}:${connection.otherDog.id}`}>
              {connection.myDog.name} → {connection.otherDog.name}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-2 text-sm font-medium">
        Starts at
        <input name="startsAtLocal" type="datetime-local" required className="rounded-lg border px-3 py-3 text-base" />
      </label>
      <input type="hidden" name="startsAt" />
      <label className="grid gap-2 text-sm font-medium">
        Note
        <input name="note" maxLength={500} placeholder="Optional walk note" className="rounded-lg border px-3 py-3 text-base" />
      </label>
      <button disabled={!connections.length} className="rounded-lg bg-slate-900 px-5 py-3 font-medium text-white disabled:opacity-50">
        Send dog-to-dog invite
      </button>
      <p className="text-xs text-slate-600">Walk invitations are available after the dogs become buddies.</p>
    </form>
  );
}
