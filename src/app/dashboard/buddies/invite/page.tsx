import QRCode from 'qrcode';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAppUrl } from '@/lib/appUrl';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function BuddyInvitePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/login');

  const inviteUrl = `${getAppUrl()}/dashboard/buddies?inviteFrom=${encodeURIComponent(user.id)}`;
  const svg = await QRCode.toString(inviteUrl, { type: 'svg', errorCorrectionLevel: 'M', margin: 2, width: 512, color: { dark: '#0f172a', light: '#ffffff' } });
  const responsiveSvg = svg.replace('<svg ', '<svg class="block h-auto w-full max-w-[300px]" role="img" aria-label="Buddies owner invite QR code" ');

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <p className="text-sm font-medium text-slate-500">Buddies invite via QR</p>
      <h1 className="text-3xl font-bold">Invite dog owners</h1>
      <p className="mt-2 text-slate-600">Share this QR code or link so another owner can open your dogs and send a dog-to-dog buddy request.</p>
      <section className="mt-8 rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex justify-center rounded-xl border bg-white p-4" dangerouslySetInnerHTML={{ __html: responsiveSvg }} />
        <p className="mt-4 break-all text-sm text-slate-600">{inviteUrl}</p>
        <div className="mt-5 grid gap-2">
          <a href={`sms:?&body=${encodeURIComponent(`Join me on Buddies: ${inviteUrl}`)}`} className="rounded-lg bg-slate-900 px-4 py-3 text-center font-medium text-white">Send invite link</a>
          <Link href="/dashboard/buddies" className="rounded-lg border px-4 py-3 text-center font-medium">Back to Buddies</Link>
        </div>
      </section>
    </main>
  );
}
