import Link from 'next/link';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

const features = [
  ['Digital dog ID', 'QR-ready safety profiles with medical and emergency details.'],
  ['Lost-dog network', 'Realtime sightings, scans, and location updates.'],
  ['Walk marketplace', 'Request, accept, track, and complete local dog walks.'],
  ['Community map', 'Discover nearby dogs, walkers, alerts, and activity.']
];

export default async function HomePage() {
  const publicDog = await prisma.dog.findFirst({
    orderBy: { createdAt: 'asc' },
    select: { slug: true }
  }).catch(() => null);
  const publicProfileHref = publicDog ? `/dogs/${publicDog.slug}` : '/dogs';

  return (
    <main className="min-h-screen">
      <section className="mx-auto max-w-6xl px-6 py-20">
        <span className="rounded-full bg-slate-900 px-3 py-1 text-sm text-white">Buddies V2</span>
        <h1 className="mt-6 max-w-3xl text-5xl font-bold tracking-tight">One network for every dog, owner, and trusted walker.</h1>
        <p className="mt-5 max-w-2xl text-lg text-slate-600">Buddies combines dog identity, emergency safety, local discovery, walking coordination, and realtime communication.</p>
        <div className="mt-8 flex gap-3">
          <Link href="/dashboard" className="rounded-lg bg-slate-900 px-5 py-3 font-medium text-white">Open dashboard</Link>
          <Link href={publicProfileHref} className="rounded-lg border border-slate-300 px-5 py-3 font-medium">View public profile</Link>
        </div>
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
