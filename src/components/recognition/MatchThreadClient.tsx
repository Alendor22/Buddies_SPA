'use client';

import { useCallback, useEffect, useState } from 'react';

type Match = {
  role: 'owner' | 'reporter';
  dog: { id: string; name: string; slug: string; photoUrl: string | null; status: string };
  score: number;
  matchedAt: string;
  photoAvailable: boolean;
  photoExpiresAt: string | null;
};

type ThreadMessage = { id: string; senderId: string; body: string; createdAt: string };

const POLL_MS = 20000;

export default function MatchThreadClient({
  requestId,
  dogId,
  viewerId,
  initialMatch
}: {
  requestId: string;
  dogId: string;
  viewerId: string;
  initialMatch: Match;
}) {
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const messagesUrl = `/api/recognition/matches/${encodeURIComponent(requestId)}/${encodeURIComponent(dogId)}/messages`;
  const photoUrl = `/api/recognition/matches/${encodeURIComponent(requestId)}/${encodeURIComponent(dogId)}/photo`;

  const refreshMessages = useCallback(async () => {
    const response = await fetch(messagesUrl, { cache: 'no-store' });
    if (response.ok) {
      const data = await response.json() as { messages?: ThreadMessage[] };
      setMessages(data.messages ?? []);
    }
  }, [messagesUrl]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await refreshMessages();
      if (!cancelled) setLoadingMessages(false);
    })();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refreshMessages();
    }, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [refreshMessages]);

  async function send() {
    const text = body.trim();
    if (!text) return;
    setSending(true);
    setError('');
    try {
      const response = await fetch(messagesUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: text }),
        cache: 'no-store'
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'The message could not be sent.');
      setBody('');
      await refreshMessages();
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'The message could not be sent.');
    } finally {
      setSending(false);
    }
  }

  const otherParty = initialMatch.role === 'owner' ? 'the finder' : "the dog's owner";

  return (
    <div className="mt-6 grid gap-5">
      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">{initialMatch.dog.name}</h2>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            {Math.round(initialMatch.score * 100)}% similarity
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-600">
          Matched {new Date(initialMatch.matchedAt).toLocaleString()} · status {initialMatch.dog.status}
        </p>

        {initialMatch.photoAvailable ? (
          <div className="mt-4">
            {/* eslint-disable-next-line @next/next/no-img-element -- authenticated, private endpoint; next/image can't proxy credentials */}
            <img
              src={photoUrl}
              alt="Found-dog photo submitted for this match"
              className="max-h-96 w-full rounded-xl border object-contain"
            />
            {initialMatch.photoExpiresAt ? (
              <p className="mt-2 text-xs text-slate-500">
                This photo is automatically deleted on {new Date(initialMatch.photoExpiresAt).toLocaleDateString()}.
              </p>
            ) : null}
          </div>
        ) : (
          <p className="mt-4 rounded-lg border border-dashed p-4 text-sm text-slate-500">
            This photo has expired and was automatically deleted.
          </p>
        )}
      </section>

      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Message {otherParty}</h2>
        <p className="mt-1 text-sm text-slate-600">
          Messages here are only visible to the two of you.
        </p>

        <div className="mt-4 flex max-h-80 flex-col gap-2 overflow-y-auto rounded-lg border bg-slate-50 p-3">
          {loadingMessages ? (
            <p className="text-sm text-slate-500" role="status">Loading messages…</p>
          ) : messages.length === 0 ? (
            <p className="text-sm text-slate-500">No messages yet. Say hello to {otherParty}.</p>
          ) : (
            messages.map((message) => {
              const mine = message.senderId === viewerId;
              return (
                <div
                  key={message.id}
                  className={`max-w-[80%] rounded-lg border px-3 py-2 text-sm ${
                    mine ? 'self-end bg-slate-900 text-white' : 'self-start bg-white'
                  }`}
                >
                  <p>{message.body}</p>
                  <p className={`mt-1 text-xs ${mine ? 'text-slate-300' : 'text-slate-400'}`}>
                    {new Date(message.createdAt).toLocaleString()}
                  </p>
                </div>
              );
            })
          )}
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
          className="mt-3 flex gap-2"
        >
          <input
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder={`Message ${otherParty}…`}
            maxLength={2000}
            className="flex-1 rounded-lg border px-3 py-2 text-sm"
            disabled={sending}
          />
          <button
            type="submit"
            disabled={sending || !body.trim()}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {sending ? 'Sending…' : 'Send'}
          </button>
        </form>
        {error ? <p className="mt-2 text-sm text-red-600" role="alert">{error}</p> : null}
      </section>
    </div>
  );
}
