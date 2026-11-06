'use client';

import { useState, type ChangeEvent } from 'react';

const VIEWS = [
  ['FRONT_LEFT', 'Front · left'],
  ['FRONT_CENTER', 'Front · center'],
  ['FRONT_RIGHT', 'Front · right'],
  ['REAR_LEFT', 'Rear · left'],
  ['REAR_CENTER', 'Rear · center'],
  ['REAR_RIGHT', 'Rear · right'],
  ['LEFT_HEAD_ON', 'Left head-on'],
  ['RIGHT_HEAD_ON', 'Right head-on']
] as const;

type CaptureView = typeof VIEWS[number][0];
type Props = { dogId: string; dogName: string; isOwner: boolean; enrolled: boolean };

function hex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

export default function DogRecognitionControls({ dogId, dogName, isOwner, enrolled: initialEnrolled }: Props) {
  const [files, setFiles] = useState<Partial<Record<CaptureView, File>>>({});
  const [consented, setConsented] = useState(false);
  const [enrolled, setEnrolled] = useState(initialEnrolled);
  const [verificationPhoto, setVerificationPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  function setView(view: CaptureView, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) setFiles((current) => ({ ...current, [view]: file }));
  }

  async function requestJson(url: string, body: unknown) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store'
    });
    const payload = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) throw new Error(payload.error || 'The request failed.');
    return payload;
  }

  async function enroll() {
    if (!consented) return setMessage('Consent is required before sending reference photos for processing.');
    if (VIEWS.some(([view]) => !files[view])) return setMessage('Add all eight labeled photos before enrolling.');
    setBusy(true);
    setMessage('Preparing the eight-view identity enrollment…');
    try {
      await requestJson('/api/recognition/enrollment', { dogId, consentAccepted: true });
      for (const [view] of VIEWS) {
        const file = files[view]!;
        const hash = hex(await crypto.subtle.digest('SHA-256', await file.arrayBuffer()));
        const signed = await requestJson('/api/recognition/enrollment/upload', {
          dogId, mimeType: file.type, contentLength: file.size, captureView: view
        }) as { upload?: { storageKey: string; uploadUrl: string } };
        if (!signed.upload) throw new Error('Could not prepare an image upload.');
        const uploaded = await fetch(signed.upload.uploadUrl, {
          method: 'PUT', headers: { 'Content-Type': file.type }, body: file
        });
        if (!uploaded.ok) throw new Error('A reference photo could not be uploaded. Check R2 upload permissions.');
        const saved = await fetch('/api/recognition/enrollment/assets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dogId, storageKey: signed.upload.storageKey, contentHash: hash, mimeType: file.type, captureView: view }),
          cache: 'no-store'
        });
        const savedPayload = await saved.json().catch(() => ({})) as { asset?: { id: string }; error?: string };
        if (!saved.ok || !savedPayload.asset) throw new Error(savedPayload.error || 'Could not register a reference photo.');
        const processed = await fetch('/api/recognition/enrollment/assets', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assetId: savedPayload.asset.id }),
          cache: 'no-store'
        });
        const processedPayload = await processed.json().catch(() => ({})) as { error?: string };
        if (!processed.ok) throw new Error(processedPayload.error || 'A reference photo could not be processed.');
      }
      await requestJson('/api/recognition/enrollment/activate', { dogId });
      setEnrolled(true);
      setMessage(`${dogName} is enrolled with eight reference views.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Enrollment could not be completed.');
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    if (!verificationPhoto) return setMessage('Choose a clear photo of the dog to verify.');
    setBusy(true);
    setMessage('Comparing this photo with the enrolled views…');
    try {
      const form = new FormData();
      form.set('dogId', dogId);
      form.set('image', verificationPhoto);
      const response = await fetch('/api/recognition/verify', { method: 'POST', body: form, cache: 'no-store' });
      const payload = await response.json().catch(() => ({})) as { matched?: boolean; score?: number; error?: string };
      if (!response.ok) throw new Error(payload.error || 'Verification failed.');
      setMessage(payload.matched
        ? `Possible match for ${dogName} (similarity ${Math.round((payload.score ?? 0) * 100)}%).`
        : `No confident match for ${dogName}. Review the dog and try another clear photo.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Verification failed.');
    } finally {
      setBusy(false);
    }
  }

  if (!isOwner && !enrolled) return null;

  return (
    <section className="mt-6 rounded-xl border border-sky-200 bg-sky-50 p-4" aria-labelledby="dog-identity-heading">
      <h2 id="dog-identity-heading" className="font-semibold">Visual dog identity</h2>
      {isOwner && !enrolled ? (
        <>
          <p className="mt-1 text-sm text-slate-700">Enroll eight clear views. Keep the whole dog centered, use good light, and capture one dog at a time.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {VIEWS.map(([view, label]) => (
              <label key={view} className="grid gap-1 text-sm font-medium">
                {label}
                <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(event) => setView(view, event)} className="rounded-lg border bg-white p-2" />
              </label>
            ))}
          </div>
          <label className="mt-4 flex items-start gap-2 text-sm">
            <input type="checkbox" checked={consented} onChange={(event) => setConsented(event.target.checked)} />
            <span>I consent to sending these dog photos to the configured recognition service to create an identity template. Buddies stores the reference photos in its protected media storage until enrollment is revoked.</span>
          </label>
          <button type="button" onClick={enroll} disabled={busy || !consented} className="mt-4 rounded-lg bg-slate-900 px-4 py-2 font-medium text-white disabled:opacity-50">
            {busy ? 'Enrolling…' : 'Enroll eight views'}
          </button>
        </>
      ) : enrolled ? (
        <>
          <p className="mt-1 text-sm text-slate-700">This QR opens this dog’s profile. Capture a fresh photo here to compare it with the eight enrolled reference views.</p>
          <label className="mt-3 grid gap-2 text-sm font-medium">
            Current dog photo
            <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(event) => setVerificationPhoto(event.target.files?.[0] ?? null)} className="rounded-lg border bg-white p-2" />
          </label>
          <button type="button" onClick={verify} disabled={busy || !verificationPhoto} className="mt-3 rounded-lg bg-slate-900 px-4 py-2 font-medium text-white disabled:opacity-50">
            {busy ? 'Checking…' : 'Verify this dog'}
          </button>
        </>
      ) : null}
      {message ? <p className="mt-3 text-sm" role="status">{message}</p> : null}
    </section>
  );
}
