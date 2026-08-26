'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { ActiveDogMapItem } from '@/components/map/LiveMapLayers';

type Sheet = 'buddies' | 'report' | 'dogid' | null;

const REPORTS = [
  ['WATER_BOWL', '💧', 'Water'],
  ['POOP_BAG_STATION', '💩', 'Bags'],
  ['LOOSE_DOG', '🐕', 'Loose dog'],
  ['AGGRESSIVE_DOG', '⚠️', 'Aggressive'],
  ['CROWDED_PARK', '👥', 'Crowded'],
  ['HAZARD', '🚧', 'Hazard']
] as const;

export default function SpatialOverlaySheet({ activeDogs }: { activeDogs: ActiveDogMapItem[] }) {
  const [sheet, setSheet] = useState<Sheet>(null);
  const [message, setMessage] = useState('');
  const buddies = activeDogs.filter((dog) => dog.isBuddy);

  useEffect(() => {
    const openBuddies = () => setSheet('buddies');
    const openReport = () => setSheet('report');
    const openDogId = () => setSheet('dogid');
    window.addEventListener('buddies:open-buddies', openBuddies);
    window.addEventListener('buddies:open-report', openReport);
    window.addEventListener('buddies:open-dogid', openDogId);
    return () => {
      window.removeEventListener('buddies:open-buddies', openBuddies);
      window.removeEventListener('buddies:open-report', openReport);
      window.removeEventListener('buddies:open-dogid', openDogId);
    };
  }, []);

  if (!sheet) return null;

  function chooseReport(type: string) {
    window.dispatchEvent(new CustomEvent('buddies:create-map-report', { detail: { type } }));
    setMessage(`${type.replaceAll('_', ' ').toLowerCase()} selected. Tap the map to place it.`);
  }

  return (
    <div className="absolute inset-x-3 bottom-24 z-50 mx-auto max-w-xl rounded-3xl border border-white/30 bg-slate-950/80 p-4 text-white shadow-2xl backdrop-blur-2xl sm:inset-x-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-black">{sheet === 'buddies' ? 'Nearby Buddies' : sheet === 'report' ? 'Report to the pack' : 'Buddies DogID'}</h2>
        <button type="button" onClick={() => { setSheet(null); setMessage(''); }} className="grid h-10 w-10 place-items-center rounded-full border border-white/20 text-xl" aria-label="Close">×</button>
      </div>

      {sheet === 'buddies' ? (
        <div className="grid max-h-64 gap-2 overflow-auto">
          {buddies.length ? buddies.map((dog) => (
            <Link key={dog.id} href={dog.dogSlug ? `/dogs/${dog.dogSlug}` : '/dogs'} className="flex items-center gap-3 rounded-2xl bg-white/10 p-3">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-white font-black text-slate-950">{dog.avatar || dog.dogName.slice(0, 2).toUpperCase()}</span>
              <span className="min-w-0"><span className="block font-bold">{dog.dogName}</span><span className="block truncate text-xs text-white/60">{dog.breed || 'Dog buddy'} · {dog.status}</span></span>
            </Link>
          )) : <p className="rounded-2xl bg-white/10 p-4 text-sm text-white/70">No accepted Buddies are active in the current map window.</p>}
        </div>
      ) : null}

      {sheet === 'report' ? (
        <div className="grid grid-cols-3 gap-2">
          {REPORTS.map(([type, icon, label]) => (
            <button key={type} type="button" onClick={() => chooseReport(type)} className="grid min-h-20 place-items-center rounded-2xl bg-white/10 p-2 text-center text-xs font-bold active:bg-white/20"><span className="text-2xl" aria-hidden="true">{icon}</span><span>{label}</span></button>
          ))}
        </div>
      ) : null}

      {sheet === 'dogid' ? (
        <div className="grid gap-3 text-sm">
          <p className="text-white/70">Choose a dog profile to expose its existing QR identity. Native NFC/BLE exchange will plug into this same surface.</p>
          <Link href="/dogs" className="rounded-2xl bg-white px-4 py-3 text-center font-black text-slate-950">Choose DogID</Link>
          <Link href="/qr-dog" className="rounded-2xl border border-white/25 px-4 py-3 text-center font-bold">Scan DogID</Link>
        </div>
      ) : null}

      {message ? <p className="mt-3 rounded-xl bg-white/10 px-3 py-2 text-xs text-white/70" role="status">{message}</p> : null}
    </div>
  );
}
