import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy | Buddies',
  description: 'How LendCo collects, uses, and protects information in Buddies.'
};

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 text-slate-900">
      <nav className="mb-8 flex gap-5 text-sm underline">
        <Link href="/">Buddies home</Link>
        <Link href="/terms">Terms of Service</Link>
        <Link href="/data-deletion">Delete my data</Link>
      </nav>
      <article className="space-y-6 leading-7">
        <header className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">LendCo · Buddies</p>
          <h1 className="text-4xl font-bold tracking-tight">Privacy Policy</h1>
          <p className="text-sm text-slate-600">Effective date: November 14, 2026</p>
        </header>

        <p>
          This Privacy Policy explains how LendCo (“LendCo,” “we,” “us,” or “our”) handles
          information when you use Buddies, including its website, dog profiles, maps,
          messaging, lost-dog tools, and optional connections to Meta services.
        </p>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">Information we handle</h2>
          <p>Depending on the features you use, we may handle:</p>
          <ul className="list-disc space-y-2 pl-6">
            <li><strong>Account information:</strong> name, email address, sign-in details, and account identifiers.</li>
            <li><strong>Dog and profile information:</strong> dog names, profile details, QR identifiers, and photos or other content you submit.</li>
            <li><strong>Location and activity information:</strong> device location, selected map areas, routes, walks, check-ins, and lost-dog sightings when you use features that need them. Your device or browser controls location permission.</li>
            <li><strong>Messages and social activity:</strong> messages, conversation details, buddy requests, invitations, reports, and your choices about visibility or sharing.</li>
            <li><strong>Technical information:</strong> device and browser details, log and diagnostic data, and information needed to secure and operate the service.</li>
            <li><strong>Connected Meta business information:</strong> if you choose to connect an eligible Facebook Page or Instagram professional account, we may process the selected asset identifiers, permissions, connection status, and the contact and consent information needed for the features you enable.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">How we use information</h2>
          <p>We use information to provide and maintain Buddies; create and manage accounts and dog profiles; operate maps, walks, messaging, QR and lost-dog features; protect users and prevent abuse; respond to support requests; and diagnose, secure, and improve the service.</p>
          <p>We use location only for features that rely on it, such as map display, nearby activity, route or walk functions, and location-based reports. You can turn off device or browser location permission, though related features may not work.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">When information is shared</h2>
          <p>We share information with service providers that help us run Buddies, such as authentication, hosting, database, media-storage, mapping, and realtime-service providers. They process information to provide services to us under their own terms and privacy practices.</p>
          <p>Some profile or dog information is visible according to the visibility choices and feature settings you select. You control content you choose to make public or send to other users.</p>
          <p>
            Connecting a Meta account or sharing content to a Meta service is optional. When that
            feature is enabled, Buddies asks you to choose the account or asset and authorize the
            requested access. A Buddies share summary is created only after your action, contains
            limited content such as a dog name or event title, and is designed to expire after
            seven days. You can revoke a share in Buddies; revocation stops Buddies from serving
            it, but cannot remove copies or previews already retained by another service or person.
          </p>
          <p>We may also disclose information when reasonably necessary to comply with law, protect users or the service, respond to a valid legal request, or address fraud, safety, or security issues. If LendCo undergoes a business transfer, information may be transferred as part of that transaction subject to applicable law.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">Meta information and choices</h2>
          <p>Meta connections and sharing are optional and are used only for the Buddies features you choose to use. We do not use Meta information to build advertising profiles. You can disconnect an asset and revoke a sharing link in the Buddies account settings. You can also revoke Buddies access through Meta’s business integrations settings.</p>
          <p>When you disconnect, Buddies removes the local connection information and related integration records as applicable. Meta may continue to hold information under its own policies. You may ask us to delete your Buddies account or submit a privacy request using the contact below.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">Retention and security</h2>
          <p>We retain information for as long as needed to provide Buddies, meet the purposes described here, resolve disputes, enforce our terms, and meet legal or security obligations. Retention periods vary by information type. Expiring or revoked share links stop being available through Buddies, but recipients or other services may have kept copies.</p>
          <p>We use administrative, technical, and organizational safeguards designed to protect information. No online service can guarantee perfect security. Please use a unique password and contact us if you believe your account has been accessed without permission.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">Your choices and privacy requests</h2>
          <p>You can update profile information and visibility choices in Buddies, revoke location permission in your device or browser, and disconnect Meta assets in your account settings. To request deletion of Meta connection data or your Buddies account, follow the <Link className="font-semibold underline" href="/data-deletion">data deletion instructions</Link> or email us. We may verify your identity before acting and retain information where law or security obligations require it.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">Children</h2>
          <p>Buddies is not intended for children under 13, and we do not knowingly ask children under 13 to create accounts. If you believe a child has provided personal information, contact us so we can review the request.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">Changes and contact</h2>
          <p>We may update this policy as Buddies changes. We will post the current version here and update its effective date.</p>
          <p>For privacy questions, access or deletion requests, or concerns about this policy, contact LendCo at <a className="font-semibold underline" href="mailto:alendor6@gmail.com">alendor6@gmail.com</a>.</p>
        </section>
      </article>
    </main>
  );
}
