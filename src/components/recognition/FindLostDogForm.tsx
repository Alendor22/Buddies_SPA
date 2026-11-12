'use client';

import Link from 'next/link';
import { useState } from 'react';
import { normalizeRecognitionPhoto } from '@/lib/recognition/normalizePhoto';

type Match = {
  dogId: string;
  publicId: string | null;
  name: string;
  profileUrl: string;
  qrUrl: string;
  matchUrl: string;
  score: number;
  ownerNotified: boolean;
};

export default function FindLostDogForm() {
  const [photo, setPhoto] = useState<File | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [consented, setConsented] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function search() {
    if (!consented) {
      setMessage('Consent is required before sending the photo for one-time matching.');
      return;
    }
    if (!photo) {
      setMessage('Choose a clear photo of the found dog first.');
      return;
    }

    setBusy(true);
    setMessage('Preparing the photo for matching…');
    setMatches([]);

    try {
      const normalizedPhoto = await normalizeRecognitionPhoto(photo);
      setMessage('Comparing the photo with enrolled lost-dog profiles…');
      const form = new FormData();
      form.set('image', normalizedPhoto);
      const response = await fetch('/api/recognition/search', {
        method: 'POST',
        body: form,
        cache: 'no-store'
      });
      const payload = await response.json().catch(() => ({})) as {
        error?: string;
        matches?: Match[];
      };
      if (!response.ok) throw new Error(payload.error || 'Lost-dog search failed.');
      setMatches(payload.matches ?? []);
      setMessage(payload.matches?.length
        ? 'Possible matches found. The owner has been notified and must confirm the identity.'
        : 'No confident lost-dog match was found. Try a clearer angle or report the dog to local shelters.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Lost-dog search failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto max-w-2xl rounded-2xl border border-sky-200 bg-sky-50 p-5 shadow-sm">
      <h1 className="text-2xl font-semibold text-slate-900">Find a lost dog</h1>
      <p className="mt-2 text-sm text-slate-700">
        Upload one clear photo. Buddies compares it with enrolled profiles whose dogs are marked lost.
        A possible match is sent to the owner for confirmation.
      </p>
      <label className="mt-5 grid gap-2 text-sm font-medium text-slate-900">
        Found-dog photo
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => setPhoto(event.target.files?.[0] ?? null)}
          className="rounded-lg border bg-white p-3"
        />
      </label>
      <label className="mt-4 flex items-start gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={consented} onChange={(event) => setConsented(event.target.checked)} aria-label="Consent to one-time found-dog matching" />
        <span>
          I consent to sending this photo for one-time matching. If it matches a lost dog, Buddies keeps the photo
          for up to 7 days so the owner can review it, then deletes it automatically. If there&apos;s no match,
          it&apos;s never stored.
        </span>
      </label>
      <button
        type="button"
        onClick={search}
        disabled={busy || !photo || !consented}
        className="mt-5 rounded-lg bg-slate-900 px-4 py-2 font-medium text-white disabled:opacity-50"
      >
        {busy ? 'Searching…' : 'Search lost dogs'}
      </button>
      {message ? <p className="mt-4 text-sm text-slate-700" role="status">{message}</p> : null}
      {matches.length > 0 ? (
        <div className="mt-5 grid gap-3">
          {matches.map((match) => (
            <article key={match.dogId} className="rounded-xl border bg-white p-4">
              <h2 className="font-semibold text-slate-900">Possible match: {match.name}</h2>
              <p className="mt-1 text-sm text-slate-600">
                Similarity {Math.round(match.score * 100)}%. The owner has been notified; identity still requires confirmation.
              </p>
              <div className="mt-3 flex flex-wrap gap-3 text-sm">
                <Link href={match.matchUrl} className="rounded-lg bg-sky-700 px-3 py-2 font-medium text-white">Message the owner</Link>
                <Link href={match.profileUrl} className="rounded-lg bg-slate-900 px-3 py-2 font-medium text-white">Open profile</Link>
                <Link href={match.qrUrl} className="rounded-lg border border-slate-300 px-3 py-2 font-medium text-slate-800">Open QR</Link>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
