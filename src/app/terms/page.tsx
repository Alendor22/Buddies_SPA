import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms of Service | Buddies',
  description: 'Terms for using Buddies, operated by LendCo.'
};

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 text-slate-900">
      <nav className="mb-8 flex gap-5 text-sm underline">
        <Link href="/">Buddies home</Link>
        <Link href="/privacy-policy">Privacy Policy</Link>
      </nav>
      <article className="space-y-6 leading-7">
        <header className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">LendCo · Buddies</p>
          <h1 className="text-4xl font-bold tracking-tight">Terms of Service</h1>
          <p className="text-sm text-slate-600">Effective date: November 14, 2026</p>
        </header>

        <p>
          These Terms of Service (“Terms”) govern your access to Buddies, operated by LendCo
          (“LendCo,” “we,” “us,” or “our”). By creating an account or using Buddies, you agree
          to these Terms. If you do not agree, do not use the service.
        </p>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">Who may use Buddies</h2>
          <p>You must be at least 13 years old to use Buddies. If you are under the age of majority where you live, use Buddies only with the permission and supervision of a parent or legal guardian.</p>
          <p>You are responsible for maintaining access to your account and for activity that occurs through it. Keep your sign-in information secure and tell us promptly if you suspect unauthorized use.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">Your content and permissions</h2>
          <p>You retain ownership of content you submit. You give LendCo a limited, non-exclusive, worldwide license to host, store, reproduce, and display that content only as needed to operate, secure, and provide Buddies features you use. This license ends when the content is removed, subject to copies retained for backups, legal requirements, or service integrity.</p>
          <p>You must have the rights and permissions needed to upload or share any profile details, photos, messages, or other material. Do not post another person’s private information without their permission. You are responsible for keeping your dog and contact information accurate and for choosing appropriate profile and location visibility settings.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">Acceptable use</h2>
          <p>You agree not to use Buddies to harass, threaten, defraud, or harm others; impersonate another person; violate privacy or intellectual-property rights; distribute unlawful, abusive, or malicious content; interfere with the service or its security; or attempt to access accounts, data, or systems without authorization.</p>
          <p>Do not use Buddies to send unsolicited or unlawful messages. If a Meta messaging feature is available to you, use it only for recipients who have given the required consent, follow the displayed opt-out instructions, and comply with Meta’s terms and messaging rules.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">Location, dog safety, and third parties</h2>
          <p>Map, route, nearby-activity, check-in, and lost-dog information may be delayed, incomplete, or inaccurate. Use your judgment and do not rely on Buddies as an emergency service, a substitute for veterinary advice, or a guarantee that a dog or person is safe. You are responsible for your own decisions and for the care and control of your dog.</p>
          <p>Buddies may link to or connect with third-party services, including Meta. Those services are governed by their own terms and privacy policies. LendCo does not control third-party services or content. Your use of Meta features is also subject to the applicable Meta terms and policies.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">Account restrictions and termination</h2>
          <p>We may investigate suspected violations, remove content, limit features, or suspend or terminate access when reasonably necessary to protect users, the service, or comply with law. You may stop using Buddies at any time and request account deletion by contacting us. Some information may remain where necessary for legal, security, backup, or dispute-resolution purposes as described in the <a className="font-semibold underline" href="/privacy-policy">Privacy Policy</Link>.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">Service availability and disclaimers</h2>
          <p>Buddies is provided on an “as available” basis. To the extent permitted by law, LendCo disclaims implied warranties, including merchantability, fitness for a particular purpose, and non-infringement. We do not promise uninterrupted, error-free, or permanently available service.</p>
          <p>To the extent permitted by law, LendCo will not be liable for indirect, incidental, special, consequential, exemplary, or punitive damages, or for loss of data, profits, goodwill, or business arising from use of or inability to use Buddies. Nothing in these Terms excludes liability that cannot legally be excluded.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">Changes and contact</h2>
          <p>We may update these Terms as Buddies changes. We will post the current version here and update its effective date. Continued use after a change takes effect means you accept the updated Terms.</p>
          <p>Questions about these Terms can be sent to LendCo at <a className="font-semibold underline" href="mailto:alendor6@gmail.com">alendor6@gmail.com</Link>.</p>
        </section>
      </article>
    </main>
  );
}
