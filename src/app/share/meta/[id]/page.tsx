import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { enabled } from '@/lib/meta/security';

export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false }, referrer: 'no-referrer' };
export default async function MetaSharePage({ params }: { params: Promise<{ id: string }> }) {
  if (!enabled() || !enabled('SHARING')) notFound();
  const { id } = await params;
  if (!/^[a-f0-9-]{36}$/.test(id)) notFound();
  const share = await prisma.metaShare.findFirst({ where: { id, expiresAt: { gt: new Date() } }, select: { title: true } });
  if (!share) notFound();
  return <main className="mx-auto max-w-xl p-8"><h1 className="text-2xl font-bold">{share.title}</h1><p className="my-4">Shared with permission. This summary expires after seven days.</p><Link href="/">Explore Buddies</Link></main>;
}
