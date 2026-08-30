export const dynamic = 'force-dynamic';

const features = [
  ['Spatial dog network', 'A first-person map for nearby dogs, Buddies, routes, reports, resources, and live activity.'],
  ['Digital dog ID', 'QR-ready safety profiles with a camera scanner designed to extend into NFC and BLE identity exchange.'],
  ['Automatic walks', 'Device telemetry detects walking, jogging, pauses, and likely driving to build route memory.'],
  ['Dog-centric reports', 'Share water, bag stations, loose dogs, hazards, crowded parks, and other neighborhood signals.']
];

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <section className="mx-auto max-w-6xl px-6 py-20">
        <span className="rounded-full bg-slate-900 px-3 py-1 text-sm text-white">Buddies Spatial</span>
        <h1 className="mt-6 max-w-3xl text-5xl font-bold tracking-tight">Your dog community, visualized in the real world.</h1>
        <p className="mt-5 max-w-2xl text-lg text-slate-600">Buddies is becoming a map-first spatial network for walking, identity, nearby dogs, safety, community reports, resources, and route intelligence.</p>
      </section>
      <section className="mx-auto grid max-w-6xl gap-4 px-6 pb-20 md:grid-cols-2">
        {features.map(([title, body]) => (
          <article key={title} className="rounded-2xl border bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold">{title}</h2>
            <p className="mt-2 text-slate-600">{body}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
