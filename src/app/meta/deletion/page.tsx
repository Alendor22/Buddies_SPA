export const metadata = { robots: { index: false, follow: false } };
export default function MetaDeletionPage() {
  return <main className="mx-auto max-w-xl p-8"><h1 className="text-2xl font-bold">Meta data deletion</h1><p>Successful deletion callbacks erase business connection tokens, recipient consent records and delivery metadata. Buddies login remains managed by Clerk. You can also disconnect business accounts and revoke sharing links in Account → Meta connections and sharing.</p><p>Contact the Buddies support channel listed in the application’s privacy policy for account-wide data requests.</p></main>;
}
