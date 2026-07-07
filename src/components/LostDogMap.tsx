type LostDogMapProps = {
  name: string;
  lastSeenLocation?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  sightings?: { id: string; latitude: number; longitude: number; note: string | null; createdAt: Date }[];
};

export default function LostDogMap({ name, lastSeenLocation, latitude, longitude, sightings = [] }: LostDogMapProps) {
  const hasPoint = typeof latitude === 'number' && typeof longitude === 'number';
  return (
    <section className="mt-6 overflow-hidden rounded-xl border border-red-200 bg-white shadow-sm">
      <div className="relative h-72 bg-slate-100">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_18%,rgba(239,68,68,.18),transparent_24%),radial-gradient(circle_at_72%_48%,rgba(14,165,233,.16),transparent_26%),radial-gradient(circle_at_42%_80%,rgba(34,197,94,.14),transparent_22%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(15,23,42,.09)_1px,transparent_1px),linear-gradient(rgba(15,23,42,.09)_1px,transparent_1px)] bg-[size:38px_38px]" />
        <div className="absolute -left-16 top-16 h-20 w-[140%] rotate-[-11deg] rounded-full bg-white/70" />
        <div className="absolute -left-20 top-44 h-20 w-[150%] rotate-[18deg] rounded-full bg-white/65" />
        <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-600 text-3xl text-white shadow-xl">🚩</div>
          <div className="mt-3 max-w-[260px] rounded-2xl bg-white/95 px-4 py-3 text-center shadow-lg">
            <p className="text-sm font-bold text-red-700">LOST DOG FLAG</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{name}</p>
            <p className="mt-1 text-xs text-slate-600">{lastSeenLocation ?? 'Last seen location not provided'}</p>
            {hasPoint ? <p className="mt-1 text-xs text-slate-500">{latitude}, {longitude}</p> : <p className="mt-1 text-xs text-slate-500">Approximate map from last-seen text</p>}
          </div>
        </div>
        {sightings.slice(0, 3).map((sighting, index) => (
          <div key={sighting.id} className="absolute flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white shadow" style={{ left: `${18 + index * 23}%`, top: `${65 - index * 13}%` }}>{index + 1}</div>
        ))}
      </div>
      <div className="p-4">
        <h3 className="font-semibold">Recovery map</h3>
        <p className="mt-1 text-sm text-slate-600">This is the public location panel users see after a dog is reported lost. Sightings appear as numbered markers.</p>
        {sightings.length ? <p className="mt-2 text-sm font-medium text-slate-900">{sightings.length} sighting{sightings.length === 1 ? '' : 's'} reported</p> : null}
      </div>
    </section>
  );
}
