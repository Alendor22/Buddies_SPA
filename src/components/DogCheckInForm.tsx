'use client';

import { FormEvent, useState } from 'react';

type DogOption = { id: string; name: string };

export default function DogCheckInForm({ dogs }: { dogs: DogOption[] }) {
  const [dogId, setDogId] = useState(dogs[0]?.id ?? '');
  const [placeName, setPlaceName] = useState('');
  const [note, setNote] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [status, setStatus] = useState('Use device location before checking in.');
  const [busy, setBusy] = useState(false);

  function locate() {
    if (!navigator.geolocation) {
      setStatus('Location services are unavailable.');
      return;
    }

    setStatus('Requesting location…');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude.toFixed(6));
        setLongitude(position.coords.longitude.toFixed(6));
        setStatus(`Location ready · ±${Math.round(position.coords.accuracy)} ft`);
      },
      () => setStatus('Location permission was denied.'),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setStatus('Publishing check-in…');

    try {
      const response = await fetch('/api/check-ins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dogId, placeName, note, durationMinutes, latitude, longitude })
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Check-in failed.');
      setStatus('Check-in published.');
      window.location.reload();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Check-in failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4 rounded-2xl border bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold">Check in a dog</h2>
      <button type="button" onClick={locate} className="rounded-lg border px-4 py-3 font-medium">Use device location</button>
      <p className="text-sm text-slate-600">{status}</p>
      <label className="grid gap-2 text-sm font-medium">Dog<select value={dogId} onChange={(event) => setDogId(event.target.value)} required className="rounded-lg border px-3 py-3 text-base">{dogs.map((dog) => <option key={dog.id} value={dog.id}>{dog.name}</option>)}</select></label>
      <label className="grid gap-2 text-sm font-medium">Park or place<input value={placeName} onChange={(event) => setPlaceName(event.target.value)} required maxLength={120} className="rounded-lg border px-3 py-3 text-base" /></label>
      <label className="grid gap-2 text-sm font-medium">Duration<select value={durationMinutes} onChange={(event) => setDurationMinutes(Number(event.target.value))} className="rounded-lg border px-3 py-3 text-base"><option value={30}>30 minutes</option><option value={60}>1 hour</option><option value={120}>2 hours</option><option value={240}>4 hours</option></select></label>
      <label className="grid gap-2 text-sm font-medium">Dog note<input value={note} onChange={(event) => setNote(event.target.value)} maxLength={240} className="rounded-lg border px-3 py-3 text-base" /></label>
      <input type="hidden" value={latitude} readOnly />
      <input type="hidden" value={longitude} readOnly />
      <button disabled={busy || !latitude || !longitude || !dogs.length} className="rounded-lg bg-slate-900 px-5 py-3 font-medium text-white disabled:opacity-50">{busy ? 'Publishing…' : 'Publish check-in'}</button>
    </form>
  );
}
