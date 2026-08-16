'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { channels, getRealtimeClient } from '@/lib/realtime';

type MessageItem = {
  id: string;
  senderId: string;
  senderLabel: string;
  body: string;
  createdAt: string;
};

type WalkMessageThreadProps = {
  walkId: string;
  currentUserId: string;
  currentLabel: string;
  initialMessages: MessageItem[];
};

const SEND_TIMEOUT_MS = 20000;

function isMessageItem(value: unknown): value is MessageItem {
  if (!value || typeof value !== 'object') return false;
  const message = value as Partial<MessageItem>;
  return typeof message.id === 'string'
    && typeof message.senderId === 'string'
    && typeof message.senderLabel === 'string'
    && typeof message.body === 'string'
    && typeof message.createdAt === 'string';
}

export default function WalkMessageThread({ walkId, currentUserId, currentLabel, initialMessages }: WalkMessageThreadProps) {
  const [messages, setMessages] = useState<MessageItem[]>(initialMessages);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState('Connecting realtime channel…');
  const [presenceLabels, setPresenceLabels] = useState<string[]>([]);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const latestCreatedAtRef = useRef(initialMessages.at(-1)?.createdAt ?? '');

  const onlineLabel = useMemo(() => {
    if (!presenceLabels.length) return 'Presence unavailable';
    return `${presenceLabels.length} online: ${presenceLabels.join(', ')}`;
  }, [presenceLabels]);

  function appendMessages(incoming: MessageItem[]) {
    if (!incoming.length) return;
    setMessages((current) => {
      const known = new Set(current.map((message) => message.id));
      const additions = incoming.filter((message) => !known.has(message.id));
      const next = [...current, ...additions].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      latestCreatedAtRef.current = next.at(-1)?.createdAt ?? latestCreatedAtRef.current;
      return next;
    });
  }

  async function markRead() {
    try {
      await fetch(`/api/walks/${walkId}/messages/read`, { method: 'POST' });
    } catch {
      // Read state is retried by polling and the next page load.
    }
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  useEffect(() => {
    let active = true;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let realtimeChannel: ReturnType<ReturnType<typeof getRealtimeClient>['channels']['get']> | null = null;

    async function pollMessages() {
      const after = latestCreatedAtRef.current;
      const query = after ? `?after=${encodeURIComponent(after)}` : '';
      try {
        const response = await fetch(`/api/walks/${walkId}/messages${query}`, { cache: 'no-store' });
        const payload = await response.json() as { messages?: MessageItem[] };
        if (active && response.ok) {
          appendMessages((payload.messages ?? []).filter(isMessageItem));
          if (document.visibilityState === 'visible') void markRead();
        }
      } catch {
        if (active) setStatus('Realtime unavailable; retrying message sync.');
      }
    }

    async function startRealtime() {
      try {
        const client = getRealtimeClient();
        const channel = client.channels.get(channels.messages(walkId));
        realtimeChannel = channel;

        const handleMessage = (message: { data?: unknown }) => {
          if (isMessageItem(message.data)) {
            appendMessages([message.data]);
            if (document.visibilityState === 'visible') void markRead();
          }
        };

        const refreshPresence = async () => {
          try {
            const members = await channel.presence.get();
            if (!active) return;
            const labels = members
              .map((member) => {
                const data = member.data as { label?: unknown } | null;
                return typeof data?.label === 'string' ? data.label : null;
              })
              .filter((label): label is string => Boolean(label));
            setPresenceLabels(Array.from(new Set(labels)));
          } catch {
            if (active) setPresenceLabels([]);
          }
        };

        const presenceListener = () => { void refreshPresence(); };
        await channel.subscribe('message.created', handleMessage);
        await channel.presence.subscribe('enter', presenceListener);
        await channel.presence.subscribe('leave', presenceListener);
        await channel.presence.subscribe('update', presenceListener);
        await channel.presence.enter({ label: currentLabel });
        await refreshPresence();

        if (active) setStatus('Realtime connected.');

        return () => {
          channel.unsubscribe('message.created', handleMessage);
          channel.presence.unsubscribe('enter', presenceListener);
          channel.presence.unsubscribe('leave', presenceListener);
          channel.presence.unsubscribe('update', presenceListener);
          void channel.presence.leave();
        };
      } catch {
        if (active) setStatus('Realtime credentials are unavailable; polling every 15 seconds.');
        return undefined;
      }
    }

    let stopRealtime: (() => void) | undefined;
    void startRealtime().then((cleanup) => {
      stopRealtime = cleanup;
      // Realtime already delivers messages live; only poll as a fallback when it failed to connect.
      if (!cleanup && active) {
        pollTimer = setInterval(() => { void pollMessages(); }, 15000);
      }
    });
    void markRead();

    return () => {
      active = false;
      if (pollTimer) clearInterval(pollTimer);
      stopRealtime?.();
      if (realtimeChannel) realtimeChannel.detach().catch(() => undefined);
    };
  }, [walkId, currentLabel]);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextBody = body.trim();
    if (!nextBody || sending) return;

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
    setSending(true);
    setStatus('Sending…');

    try {
      const response = await fetch(`/api/walks/${walkId}/messages`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ body: nextBody }),
        signal: controller.signal,
        cache: 'no-store'
      });

      const contentType = response.headers.get('content-type') ?? '';
      if (!contentType.includes('application/json')) {
        throw new Error('The message service returned an unexpected response. Reload and try again.');
      }

      const payload = await response.json() as { message?: MessageItem; error?: string };
      if (!response.ok || !payload.message) throw new Error(payload.error || 'Message could not be sent.');

      appendMessages([payload.message]);
      setBody('');
      setStatus('Sent.');
    } catch (error) {
      const message = error instanceof DOMException && error.name === 'AbortError'
        ? 'Message timed out. Tap Send message to retry.'
        : error instanceof Error
          ? error.message
          : 'Message could not be sent.';
      setStatus(message);
    } finally {
      window.clearTimeout(timeout);
      setSending(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      <div className="border-b bg-slate-50 px-4 py-3 sm:px-6">
        <p className="text-sm font-semibold text-slate-900">{onlineLabel}</p>
        <p className="mt-1 text-xs text-slate-500" role="status" aria-live="polite">{status}</p>
      </div>

      <div className="max-h-[58vh] min-h-[360px] overflow-y-auto px-4 py-5 sm:px-6">
        <div className="grid gap-3">
          {messages.length === 0 ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">No messages yet. Start the walk conversation.</p> : messages.map((message) => {
            const mine = message.senderId === currentUserId;
            return (
              <article key={message.id} className={`max-w-[86%] rounded-2xl px-4 py-3 ${mine ? 'ml-auto bg-slate-900 text-white' : 'mr-auto bg-slate-100 text-slate-900'}`}>
                <p className={`text-xs font-semibold ${mine ? 'text-slate-300' : 'text-slate-500'}`}>{message.senderLabel}</p>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm">{message.body}</p>
                <p className={`mt-2 text-[11px] ${mine ? 'text-slate-400' : 'text-slate-500'}`}>{new Date(message.createdAt).toLocaleString()}</p>
              </article>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </div>

      <form onSubmit={sendMessage} className="border-t p-4 sm:p-6">
        <label className="sr-only" htmlFor="walk-message">Message</label>
        <textarea id="walk-message" value={body} onChange={(event) => setBody(event.target.value)} maxLength={2000} rows={3} placeholder={`Message as ${currentLabel}`} className="w-full rounded-xl border px-3 py-3 text-base" />
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-xs text-slate-500">{body.length}/2000</p>
          <button type="submit" disabled={sending || !body.trim()} className="rounded-lg bg-slate-900 px-5 py-3 font-medium text-white disabled:opacity-50">{sending ? 'Sending…' : 'Send message'}</button>
        </div>
      </form>
    </section>
  );
}
