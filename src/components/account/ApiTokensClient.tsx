'use client';

import { useState } from 'react';

type TokenRow = { id: string; name: string; createdAt: string; lastUsedAt: string | null; revokedAt: string | null };

export default function ApiTokensClient({ initialTokens }: { initialTokens: TokenRow[] }) {
  const [tokens, setTokens] = useState(initialTokens);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [mintedToken, setMintedToken] = useState<{ name: string; token: string } | null>(null);

  async function refresh() {
    const response = await fetch('/api/account/tokens', { cache: 'no-store' });
    if (response.ok) setTokens((await response.json()).tokens ?? []);
  }

  async function createToken() {
    if (!name.trim()) return setError('Give the token a name so you remember what it is for.');
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/account/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
        cache: 'no-store'
      });
      const payload = await response.json().catch(() => ({})) as { error?: string; token?: { name: string; token: string } };
      if (!response.ok || !payload.token) throw new Error(payload.error || 'The token could not be created.');
      setMintedToken({ name: payload.token.name, token: payload.token.token });
      setName('');
      await refresh();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'The token could not be created.');
    } finally {
      setBusy(false);
    }
  }

  async function revokeToken(id: string) {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/account/tokens/${encodeURIComponent(id)}`, { method: 'DELETE', cache: 'no-store' });
      if (!response.ok) throw new Error('The token could not be revoked.');
      await refresh();
    } catch (revokeError) {
      setError(revokeError instanceof Error ? revokeError.message : 'The token could not be revoked.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold">Personal access tokens</h2>
      <p className="mt-2 text-sm text-slate-600">
        Generate a token to let an MCP client — for example a ChatGPT connector — act as you against{' '}
        <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">/api/mcp</code>. Anyone with the token can read your
        dog profiles, walks, and notifications, so treat it like a password and revoke it if it leaks.
      </p>

      {mintedToken ? (
        <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">
            &ldquo;{mintedToken.name}&rdquo; created. Copy it now — it will not be shown again.
          </p>
          <code className="mt-2 block break-all rounded bg-white px-3 py-2 text-sm">{mintedToken.token}</code>
          <button
            type="button"
            onClick={() => setMintedToken(null)}
            className="mt-3 rounded-lg border px-3 py-1.5 text-sm font-medium"
          >
            Done, I copied it
          </button>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. ChatGPT connector"
          maxLength={80}
          className="flex-1 rounded-lg border px-3 py-2 text-sm"
          disabled={busy}
        />
        <button
          type="button"
          onClick={createToken}
          disabled={busy || !name.trim()}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Generate token
        </button>
      </div>
      {error ? <p className="mt-2 text-sm text-red-600" role="alert">{error}</p> : null}

      <div className="mt-5 grid gap-2">
        {tokens.length === 0 ? (
          <p className="text-sm text-slate-500">No personal access tokens yet.</p>
        ) : (
          tokens.map((entry) => (
            <div key={entry.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
              <div>
                <p className="font-medium text-slate-900">{entry.name}</p>
                <p className="text-xs text-slate-500">
                  Created {new Date(entry.createdAt).toLocaleDateString()}
                  {entry.lastUsedAt ? ` · last used ${new Date(entry.lastUsedAt).toLocaleDateString()}` : ' · never used'}
                  {entry.revokedAt ? ' · revoked' : ''}
                </p>
              </div>
              {entry.revokedAt ? (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">Revoked</span>
              ) : (
                <button
                  type="button"
                  onClick={() => revokeToken(entry.id)}
                  disabled={busy}
                  className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 disabled:opacity-50"
                >
                  Revoke
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
