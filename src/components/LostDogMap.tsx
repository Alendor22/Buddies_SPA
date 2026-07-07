type LostDogMapProps = {
  name: string;
  lastSeenLocation?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  sightings?: { id: string; latitude: number; longitude: number; note: string | null; createdAt: Date }[];
};

function openStreetMapEmbed(latitude: number, longitude: number) {
  const latitudeDelta = 0.012;
  const longitudeDelta = 0.016;
  const bounds = [
    longitude - longitudeDelta,
    latitude - latitudeDelta,
    longitude + longitudeDelta,
    latitude + latitudeDelta
  ].join(',');

  const query = new URLSearchParams({
    bbox: bounds,
    layer: 'mapnik',
    marker: `${latitude},${longitude}`
  });

  return `https://www.openstreetmap.org/export/embed.html?${query.toString()}`;
}

function openStreetMapLink(latitude: number, longitude: number, zoom = 16) {
  return `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=${zoom}/${latitude}/${longitude}`;
}

export default function LostDogMap({ name, lastSeenLocation, latitude, longitude, sightings = [] }: LostDogMapProps) {
  const hasPoint = typeof latitude === 'number' && typeof longitude === 'number';

  return (
    <section className="mt-6 overflow-hidden rounded-xl border border-red-200 bg-white shadow-sm">
      <div className="relative h-80 bg-slate-100">
        {hasPoint ? (
          <iframe
            title={`${name} last seen recovery map`}
            src={openStreetMapEmbed(latitude, longitude)}
            loading="lazy"
            className="absolute inset-0 h-full w-full border-0"
          />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_18%,rgba(239,68,68,.18),transparent_24%),radial-gradient(circle_at_72%_48%,rgba(14,165,233,.16),transparent_26%),linear-gradient(90deg,rgba(15,23,42,.09)_1px,transparent_1px),linear-gradient(rgba(15,23,42,.09)_1px,transparent_1px)] bg-[size:auto,auto,38px_38px,38px_38px]" />
        )}

        <div className="pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-full flex-col items-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border-4 border-white bg-red-600 text-3xl text-white shadow-xl">🚩</div>
          <div className="mt-2 max-w-[260px] rounded-2xl bg-white/95 px-4 py-3 text-center shadow-lg">
            <p className="text-xs font-bold text-red-700">LAST SEEN</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{name}</p>
            <p className="mt-1 text-xs text-slate-600">{lastSeenLocation ?? 'Location description not provided'}</p>
          </div>
        </div>
      </div>

      <div className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold">Recovery map</h3>
            <p className="mt-1 text-sm text-slate-600">The flag marks the saved last-seen point. Pan and zoom the street map to inspect the surrounding area.</p>
          </div>
          {hasPoint ? <a href={openStreetMapLink(latitude, longitude)} target="_blank" rel="noreferrer" className="rounded-lg border px-3 py-2 text-sm font-medium">Open full map</a> : null}
        </div>

        {!hasPoint ? <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">No map coordinates are stored yet. Edit the lost report with coordinates or a geocodable last-seen place.</p> : null}

        <div className="mt-4">
          <h4 className="text-sm font-semibold">Reported sightings</h4>
          <div className="mt-2 grid gap-2">
            {sightings.length === 0 ? <p className="text-sm text-slate-600">No sightings reported yet.</p> : sightings.map((sighting, index) => (
              <a key={sighting.id} href={openStreetMapLink(sighting.latitude, sighting.longitude)} target="_blank" rel="noreferrer" className="rounded-lg border bg-slate-50 p-3 text-sm">
                <span className="font-semibold">Sighting {index + 1}</span>
                <span className="ml-2 text-slate-600">{sighting.note ?? 'No note provided'}</span>
                <span className="mt-1 block text-xs text-slate-500">{sighting.createdAt.toLocaleString()}</span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
