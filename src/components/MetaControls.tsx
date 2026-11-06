'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type Connection = { id: string; platform: string; label: string; enabled: boolean; expiresAt: string; contacts: { id: string; externalId: string; lastInboundAt: string; optedInAt: string | null }[] };
type Share = { id: string; title: string; url?: string; facebook?: string; whatsapp?: string };
type Resource = { id: string; kind: 'profile' | 'walk' | 'event'; label: string };
async function api(action: string, body?: unknown) {
  const response = await fetch(`/api/meta/${action}`, body === undefined ? { cache: 'no-store' } : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Request failed.');
  return result;
}
export default function MetaControls({ resources, sharing, connectionsEnabled, messaging }: { resources: Resource[]; sharing: boolean; connectionsEnabled: boolean; messaging: boolean }) {
  const sendAttempt = useRef<{ fingerprint: string; key: string } | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [shares, setShares] = useState<Share[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [selection, setSelection] = useState('');
  const [consent, setConsent] = useState(false);
  const [senderDogId, setSenderDogId] = useState('');
  const [reply, setReply] = useState('');
  const [recipient, setRecipient] = useState('');
  const [evidence, setEvidence] = useState('');
  const refresh = useCallback(async () => {
    const result = await api('connections');
    setConnections(result.connections); setShares(result.shares);
  }, []);
  useEffect(() => {
    let cancelled = false;
    async function loadConnections() {
      try {
        const result = await api('connections');
        if (cancelled) return;
        setConnections(result.connections);
        setShares(result.shares);
      } catch (error) {
        if (!cancelled) setMessage(error instanceof Error ? error.message : 'Request failed.');
      }
    }
    void loadConnections();
    return () => { cancelled = true; };
  }, []);
  async function run(work: () => Promise<void>) {
    setBusy(true); setMessage('');
    try { await work(); } catch (error) { setMessage(error instanceof Error ? error.message : 'Request failed.'); }
    finally { setBusy(false); }
  }
  const selectedContact = connections.flatMap(connection => connection.contacts.map(contact => ({ ...contact, connectionId: connection.id }))).find(contact => contact.id === recipient);
  return <div className="space-y-8">
    <p role="status" aria-live="polite">{message}</p>
    {connectionsEnabled && <section className="space-y-3 rounded border p-4"><h2 className="text-xl font-semibold">Business accounts</h2>
      <p>Choose the access you need. Each new connection starts paused until you enable it.</p>
      <label>Connection type <select id="meta-purpose" className="border p-2" defaultValue="facebook">
        <option value="facebook">Facebook Pages</option><option value="instagram">Instagram professional accounts</option>
        {messaging && <><option value="facebook_messaging">Facebook Page messaging</option><option value="instagram_messaging">Instagram messaging</option><option value="whatsapp">WhatsApp business messaging</option></>}
      </select></label>
      <button disabled={busy} className="rounded border p-2" onClick={() => void run(async () => {
        const value = (document.getElementById('meta-purpose') as HTMLSelectElement).value;
        const result = await api('connect', { purpose: value }); window.location.assign(result.url);
      })}>Connect with Meta</button>
      {connections.map(connection => <div key={connection.id} className="space-x-3 border-t py-3"><strong>{connection.label}</strong> ({connection.platform}) — {connection.enabled ? 'Enabled' : 'Paused'}
        <button disabled={busy} onClick={() => void run(async () => { await api('connection', { id: connection.id, enabled: !connection.enabled }); await refresh(); })}>{connection.enabled ? 'Pause' : 'Enable'}</button>
        <button disabled={busy} onClick={() => void run(async () => { await api('disconnect', { id: connection.id }); await refresh(); })}>Disconnect and erase stored token</button>
      </div>)}
    </section>}
    {sharing && <section className="space-y-3 rounded border p-4"><h2 className="text-xl font-semibold">Share a summary</h2>
      <label>Profile, walk or public event <select className="border p-2" value={selection} onChange={event => setSelection(event.target.value)}><option value="">Select an item</option>{resources.map((resource, index) => <option key={`${resource.kind}:${resource.id}`} value={index}>{resource.label} ({resource.kind})</option>)}</select></label>
      <label className="block"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} /> I agree to make this item’s name public for seven days. Locations and contact details are excluded.</label>
      <button disabled={busy || !consent || selection === ''} onClick={() => void run(async () => { const resource = resources[Number(selection)]; const result = await api('share', { kind: resource.kind, resourceId: resource.id, consent }); setShares(current => [result, ...current]); })}>Create sharing links</button>
      <p>Instagram sharing uses your device’s share sheet where supported. Select Instagram if your device offers it, or copy the link. Personal Instagram posting has no browser share URL.</p>
      {shares.map(share => <div key={share.id} className="space-x-3 border-t py-3"><span>{share.title}</span>
        {share.facebook && <a href={share.facebook} target="_blank" rel="noopener noreferrer">Facebook</a>}
        {share.whatsapp && <a href={share.whatsapp} target="_blank" rel="noopener noreferrer">WhatsApp</a>}
        <button disabled={busy} onClick={() => void run(async () => { const url = share.url || `${window.location.origin}/share/meta/${share.id}`; if (navigator.share) await navigator.share({ title: share.title, url }); else { await navigator.clipboard.writeText(url); setMessage('Link copied.'); } })}>Share or copy link</button>
        <button disabled={busy} onClick={() => void run(async () => { await api('revoke-share', { id: share.id }); await refresh(); })}>Revoke link</button>
      </div>)}
    </section>}
    {messaging && <section className="space-y-3 rounded border p-4"><h2 className="text-xl font-semibold">Reply to a business contact</h2>
      <p>Only contacts from verified inbound messages appear here. Record their explicit permission before replying. Text replies require an inbound message in the last 24 hours.</p>
      <label>Recipient <select className="border p-2" value={recipient} onChange={event => setRecipient(event.target.value)}><option value="">Choose contact</option>{connections.flatMap(connection => connection.contacts.map(contact => <option key={contact.id} value={contact.id}>{connection.label}: {contact.externalId}</option>))}</select></label>
      <label className="block">Consent evidence <input className="border p-2" maxLength={500} value={evidence} onChange={event => setEvidence(event.target.value)} placeholder="How and when the recipient agreed" /></label>
      <button disabled={busy || !selectedContact || evidence.trim().length < 10} onClick={() => void run(async () => { await api('consent', { contactId: recipient, optedIn: true, evidence }); await refresh(); })}>Record recipient consent</button>
      <button disabled={busy || !selectedContact} onClick={() => void run(async () => { await api('consent', { contactId: recipient, optedIn: false, evidence: '' }); await refresh(); })}>Revoke consent</button>
      <label className="block">Send as dog <select value={senderDogId} onChange={event => setSenderDogId(event.target.value)}><option value="">Select your dog</option>{resources.filter(resource => resource.kind === 'profile').map(dog => <option key={dog.id} value={dog.id}>{dog.label}</option>)}</select></label>
      <label className="block">Reply <textarea className="block w-full border p-2" maxLength={1000} value={reply} onChange={event => setReply(event.target.value)} /></label>
      <button disabled={busy || !selectedContact?.optedInAt || !senderDogId || !reply.trim()} onClick={() => void run(async () => {
        const fingerprint = JSON.stringify([selectedContact!.connectionId, recipient, senderDogId, reply]);
        if (sendAttempt.current?.fingerprint !== fingerprint) sendAttempt.current = { fingerprint, key: crypto.randomUUID() };
        const result = await api('send', { connectionId: selectedContact!.connectionId, contactId: recipient, senderDogId, text: reply, key: sendAttempt.current.key });
        if (result.status === 'SENT') sendAttempt.current = null;
        setReply(''); setMessage(`Delivery status: ${result.status}. If uncertain, check the business inbox before sending again.`);
      })}>Send reply</button>
    </section>}
  </div>;
}
