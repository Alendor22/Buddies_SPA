import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Meta Data Deletion Status | Buddies',
  robots: { index: false, follow: false }
};

export default async function MetaDeletionStatusPage({
  searchParams
}: {
  searchParams: Promise<{ confirmation?: string }>;
}) {
  const { confirmation } = await searchParams;
  const validConfirmation = confirmation && /^[a-f0-9]{64}$/i.test(confirmation);

  return (
    <main className="mx-auto max-w-xl space-y-5 px-6 py-12 text-slate-900">
      <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">LendCo · Buddies</p>
      <h1 className="text-3xl font-bold">Meta data deletion status</h1>
      {validConfirmation ? (
        <section className="space-y-3" aria-live="polite">
          <p>Your Meta connection data deletion request has been processed.</p>
          <p className="break-all text-sm text-slate-700">
            Confirmation code: <strong>{confirmation}</strong>
          </p>
          <p>
            This request removes the Meta connection information Buddies holds for the
            connected account. It does not delete your separate Buddies account, dog profiles,
            or other Buddies content.
          </p>
        </section>
      ) : (
        <p>
          A deletion status code was not provided or is invalid. To request deletion, follow the
          <Link className="font-semibold underline" href="/data-deletion"> data deletion instructions</Link>.
        </p>
      )}
      <p>
        For help with this request, contact <a className="font-semibold underline" href="mailto:alendor6@gmail.com">alendor6@gmail.com</a>.
        <Link className="ml-1 font-semibold underline" href="/privacy-policy">Read the Privacy Policy.</Link>
      </p>
    </main>
  );
}
