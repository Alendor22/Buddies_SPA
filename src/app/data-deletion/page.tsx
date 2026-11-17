import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Data Deletion Instructions | Buddies',
  description: 'How to request deletion of Meta connection data or Buddies account data.'
};

export default function DataDeletionPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-6 py-12 text-slate-900">
      <nav className="flex gap-5 text-sm underline">
        <Link href="/">Buddies home</Link>
        <Link href="/privacy-policy">Privacy Policy</Link>
        <Link href="/terms">Terms of Service</Link>
      </nav>

      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">LendCo · Buddies</p>
        <h1 className="text-4xl font-bold tracking-tight">Data Deletion Instructions</h1>
        <p className="text-sm text-slate-600">Effective date: November 15, 2026</p>
      </header>

      <p>
        You can request deletion of information that Buddies received from Meta, as well as
        deletion of your separate Buddies account. You do not need to pay a fee or provide your
        password or Meta access token to make a request.
      </p>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">Request deletion of Meta connection data</h2>
        <ol className="list-decimal space-y-2 pl-6">
          <li>In Buddies, open Account → Meta connections and sharing, then disconnect the connected account or asset.</li>
          <li>You can also remove Buddies from your Meta account’s connected apps or business integrations settings and submit a data deletion request there if Meta presents that option.</li>
          <li>If you cannot access Buddies, email <a className="font-semibold underline" href="mailto:alendor6@gmail.com?subject=Buddies%20Meta%20data%20deletion">alendor6@gmail.com</a> with the subject “Buddies Meta data deletion request.” Include the email associated with your Buddies account and enough information to identify the connected Meta account or asset. Do not send passwords, access tokens, or government ID documents.</li>
        </ol>
        <p>
          A valid Meta deletion callback removes the linked Meta connection and its stored access
          token, associated contact and consent records, delivery metadata, and pending Meta
          authorization state associated with the connection. The callback returns a confirmation
          code and a status page after the request has been processed.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">Request deletion of your Buddies account</h2>
        <p>
          To request deletion of your Buddies account and information not limited to Meta, email
          <a className="font-semibold underline" href="mailto:alendor6@gmail.com?subject=Buddies%20account%20deletion"> alendor6@gmail.com</a>
          with the subject “Buddies account deletion request” from the email address on your
          account. We will verify the request and reply with its status. Account deletion removes
          account-associated information unless we must retain specific records for legal,
          security, fraud-prevention, or dispute-resolution purposes. Backup copies may remain
          until they are overwritten or expire under the backup cycle.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">What happens next</h2>
        <p>
          We will acknowledge your request and process it without undue delay, generally within
          30 days. If we need more time or cannot delete a particular record, we will explain why
          and what remains. Information that has already been copied, cached, or retained by Meta
          or another recipient must be managed through that service’s own privacy controls.
        </p>
        <p>
          A Meta connection deletion does not automatically delete your Buddies login, dog
          profiles, or other Buddies content. Use the separate account-deletion instructions
          above if you want those removed too. See our <Link className="font-semibold underline" href="/privacy-policy">Privacy Policy</Link>
          for more information.
        </p>
      </section>
    </main>
  );
}
