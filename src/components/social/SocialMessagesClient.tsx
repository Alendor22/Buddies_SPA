'use client';

import type * as Ably from 'ably';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { getRealtimeClient } from '@/lib/realtime';
import { channels } from '@/lib/realtime';

// Realtime is optional (Ably may be unconfigured). While it is not live, the active
// thread reconciles from the database on this interval instead.
const FALLBACK_POLL_MS = 30000;

type Dog = { id: string; name: string; ownerId: string; photoUrl?: string | null; breed?: string | null };
type Conversation = { id: string; peerId: string | null; peerName: string | null; lastBody: string | null; lastMessageAt: string | null };
type Message = { id: string; senderId: string; senderDogId: string | null; senderDogName: string | null; body: string; createdAt: string };

export default function SocialMessagesClient({ userId, dogs }: { userId: string; dogs: Dog[] }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Dog[]>([]);
  const [senderDogId, setSenderDogId] = useState(dogs[0]?.id ?? '');
  const [body, setBody] = useState('');
  const [error, setError] = useState('');

  const refreshConversations = useCallback(async () => {
    const response = await fetch('/api/social/conversations', { cache: 'no-store' });
    if (response.ok) setConversations((await response.json()).conversations ?? []);
  }, []);

  const refreshMessages = useCallback(async (id: string) => {
    const response = await fetch(`/api/social/conversations/${id}/messages`, { cache: 'no-store' });
    if (response.ok) setMessages((await response.json()).messages ?? []);
  }, []);

  useEffect(() => { void refreshConversations(); }, [refreshConversations]);
  useEffect(() => { if (activeId) void refreshMessages(activeId); }, [activeId, refreshMessages]);

  useEffect(() => {
    if (!activeId) return;
    const reconcile = () => { void refreshMessages(activeId); void refreshConversations(); };

    let client: Ably.Realtime | null = null;
    let channel: Ably.RealtimeChannel | null = null;
    try {
      const realtime = getRealtimeClient();
      const target = realtime.channels.get(channels.conversation(activeId));
      client = realtime;
      channel = target;
      void target.subscribe('message.created', reconcile).catch(() => {
        // Not attached; the polling fallback below keeps the thread current.
      });
      realtime.connection.on('connected', reconcile);
    } catch {
      client = null;
      channel = null;
    }

    const live = () => client?.connection.state === 'connected' && channel?.state === 'attached';
    const poll = window.setInterval(() => {
      if (document.visibilityState === 'visible' && !live()) reconcile();
    }, FALLBACK_POLL_MS);
    const onVisibility = () => { if (document.visibilityState === 'visible') reconcile(); };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.clearInterval(poll);
      channel?.unsubscribe('message.created', reconcile);
      client?.connection.off('connected', reconcile);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [activeId, refreshConversations, refreshMessages]);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      if (!query.trim()) return setResults([]);
      const response = await fetch(`/api/social/discovery?q=${encodeURIComponent(query.trim())}`, { cache: 'no-store' });
      if (response.ok) setResults((await response.json()).dogs ?? []);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  async function startConversation(memberId: string) {
    setError('');
    const response = await fetch('/api/social/conversations', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ memberId }) });
    const data = await response.json();
    if (!response.ok) return setError(data.error ?? 'Unable to start conversation.');
    setActiveId(data.conversationId);
    setQuery(''); setResults([]);
    await refreshConversations();
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    if (!activeId || !body.trim() || !senderDogId) return;
    setError('');
    const response = await fetch(`/api/social/conversations/${activeId}/messages`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ body, senderDogId })
    });
    const data = await response.json();
    if (!response.ok) return setError(data.error ?? 'Unable to send message.');
    setBody('');
    await refreshMessages(activeId);
    await refreshConversations();
  }

  const active = useMemo(() => conversations.find((item) => item.id === activeId), [conversations, activeId]);

  return <div className="mt-8 grid gap-6 lg:grid-cols-[320px_1fr]">
    <aside className="rounded-2xl border bg-white p-4 shadow-sm">
      <h2 className="font-semibold">New message</h2>
      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search dogs or breeds" className="mt-3 w-full rounded-lg border px-3 py-2" />
      {results.length > 0 && <div className="mt-2 grid gap-2">{results.map((dog) => <button key={dog.id} onClick={() => void startConversation(dog.ownerId)} className="rounded-lg border p-3 text-left"><strong>{dog.name}</strong><span className="block text-sm text-slate-500">{dog.breed ?? 'Dog profile'}</span></button>)}</div>}
      <h2 className="mt-6 font-semibold">Conversations</h2>
      <div className="mt-2 grid gap-2">{conversations.map((conversation) => <button key={conversation.id} onClick={() => setActiveId(conversation.id)} className={`rounded-lg border p-3 text-left ${activeId === conversation.id ? 'bg-slate-100' : ''}`}><strong>{conversation.peerName ?? 'Buddy'}</strong><span className="block truncate text-sm text-slate-500">{conversation.lastBody ?? 'No messages yet'}</span></button>)}</div>
    </aside>
    <section className="flex min-h-[520px] flex-col rounded-2xl border bg-white shadow-sm">
      <header className="border-b p-4"><h2 className="font-semibold">{active?.peerName ?? 'Select a conversation'}</h2></header>
      <div className="flex-1 space-y-3 overflow-y-auto p-4">{messages.map((message) => <div key={message.id} className={`max-w-[80%] rounded-2xl px-4 py-3 ${message.senderId === userId ? 'ml-auto bg-slate-900 text-white' : 'bg-slate-100'}`}><div className="mb-1 text-xs opacity-70">{message.senderDogName ?? 'Dog'}</div><p>{message.body}</p></div>)}</div>
      {activeId && <form onSubmit={send} className="border-t p-4"><div className="mb-3 flex gap-2"><label className="text-sm">Send as</label><select value={senderDogId} onChange={(e) => setSenderDogId(e.target.value)} className="rounded border px-2 py-1">{dogs.map((dog) => <option key={dog.id} value={dog.id}>{dog.name}</option>)}</select></div><div className="flex gap-2"><input value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} placeholder="Message" className="flex-1 rounded-lg border px-3 py-2"/><button disabled={!body.trim() || !senderDogId} className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white disabled:opacity-40">Send</button></div>{error && <p className="mt-2 text-sm text-red-600">{error}</p>}</form>}
    </section>
  </div>;
}
