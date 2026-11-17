'use client';

import { FormEvent } from 'react';

type DogOption = { id: string; name: string };

export default function WalkInvitationForm({ senderDogs, invitedDogs }: { senderDogs: DogOption[]; invitedDogs: DogOption[] }) {
  function submit(event: FormEvent<HTMLFormElement>) {
    const form = event.currentTarget;
    const localTime = form.elements.namedItem('startsAtLocal');
    const startsAt = form.elements.namedItem('startsAt');

    if (!(localTime instanceof HTMLInputElement) || !(startsAt instanceof HTMLInputElement) || !localTime.value) return;
    const instant = new Date(localTime.value);
    if (!Number.isNaN(instant.getTime())) startsAt.value = instant.toISOString();
  }

  return (
    <form action="/api/buddies/walk-invite" method="post" onSubmit={submit} className="grid gap-3">
      <label className="grid gap-2 text-sm font-medium">
        Your dog
        <select name="dogId" required className="rounded-lg border px-3 py-3 text-base">
          <option value="">Select your dog</option>
          {senderDogs.map((dog) => <option key={dog.id} value={dog.id}>{dog.name}</option>)}
        </select>
      </label>
      <label className="grid gap-2 text-sm font-medium">
        Invite a dog
        <select name="invitedDogId" required className="rounded-lg border px-3 py-3 text-base">
          <option value="">Select a dog</option>
          {invitedDogs.map((dog) => <option key={dog.id} value={dog.id}>{dog.name}</option>)}
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
      <button disabled={!senderDogs.length || !invitedDogs.length} className="rounded-lg bg-slate-900 px-5 py-3 font-medium text-white disabled:opacity-50">
        Send walk invite
      </button>
      {!invitedDogs.length ? <p className="text-xs text-slate-600">No nearby public dog profiles are currently available for walk invites.</p> : <p className="text-xs text-slate-600">Walk invites are open to safe, discoverable dogs whose owners allow invitations. You do not need to be buddies first.</p>}
    </form>
  );
}
