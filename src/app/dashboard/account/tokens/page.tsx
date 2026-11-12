import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { listPersonalAccessTokens } from '@/lib/apiTokens';
import { UI_ROUTES } from '@/lib/uiRoutes';
import ApiTokensClient from '@/components/account/ApiTokensClient';

export const dynamic = 'force-dynamic';

export default async function ApiTokensPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/sign-in');

  const tokens = await listPersonalAccessTokens(user.id);
  const initialTokens = tokens.map((token) => ({
    id: token.id,
    name: token.name,
    createdAt: token.createdAt.toISOString(),
    lastUsedAt: token.lastUsedAt ? token.lastUsedAt.toISOString() : null,
    revokedAt: token.revokedAt ? token.revokedAt.toISOString() : null
  }));

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">Buddies Account</p>
          <h1 className="mt-1 text-2xl font-bold">MCP connectors &amp; API tokens</h1>
        </div>
        <Link href={UI_ROUTES.account} className="rounded-lg border px-4 py-2">Account</Link>
      </div>
      <ApiTokensClient initialTokens={initialTokens} />
    </main>
  );
}
