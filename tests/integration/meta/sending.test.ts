import { Prisma } from '@prisma/client';
import { beforeEach, expect, it, vi } from 'vitest';
const db = vi.hoisted(() => ({ dog: { findFirst: vi.fn() }, metaConnection: { findFirst: vi.fn() }, metaContact: { findFirst: vi.fn() }, metaDelivery: { create: vi.fn(), update: vi.fn(), findUnique: vi.fn() } }));
vi.mock('@/lib/db', () => ({ prisma: db }));
import { encrypt } from '@/lib/meta/security';
import { sendMessage } from '@/lib/meta/service';
const input = { connectionId: 'connection', contactId: 'contact', senderDogId: 'dog', key: 'retry-key', text: 'Hello' };
beforeEach(() => {
  vi.stubEnv('META_CORE_ENABLED', 'true'); vi.stubEnv('META_MESSAGING_ENABLED', 'true'); vi.stubEnv('META_GRAPH_VERSION', 'v24.0'); vi.stubEnv('META_APP_SECRET', 'test'); vi.stubEnv('META_TOKEN_KEY', Buffer.alloc(32, 1).toString('base64'));
  db.dog.findFirst.mockResolvedValue({ id: 'dog' });
  db.metaConnection.findFirst.mockResolvedValue({ id: 'connection', platform: 'facebook', externalId: '123', ownerId: 'owner', enabled: true, scopes: ['pages_messaging'], expiresAt: new Date(Date.now() + 60000), token: encrypt('private-token', 'owner:facebook:123') });
  db.metaContact.findFirst.mockResolvedValue({ externalId: '456', optedInAt: new Date(), lastInboundAt: new Date() });
  db.metaDelivery.create.mockResolvedValue({}); db.metaDelivery.update.mockResolvedValue({ status: 'SENT' });
});
it('sends only the verified recipient and records the owned sender dog before provider request', async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({ message_id: 'm1' })); vi.stubGlobal('fetch', fetcher);
  await sendMessage('owner', input);
  expect(db.metaDelivery.create.mock.calls[0][0].data.senderDogId).toBe('dog');
  expect(db.metaContact.findFirst).toHaveBeenCalledWith({ where: { id: 'contact', connectionId: 'connection' } });
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ recipient: { id: '456' }, message: { text: 'Hello' }, messaging_type: 'RESPONSE' });
  expect(db.metaDelivery.update.mock.calls[0][0].data).toEqual({ status: 'SENT', providerId: 'm1' });
});
it('returns the existing attempt for a duplicate key without another send', async () => {
  db.metaDelivery.create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('duplicate', { code: 'P2002', clientVersion: '6' }));
  db.metaDelivery.findUnique.mockResolvedValue({ status: 'PENDING' }); const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  expect(await sendMessage('owner', input)).toEqual({ status: 'PENDING' }); expect(fetcher).not.toHaveBeenCalled();
});
it('preserves ambiguous sends as UNKNOWN and does not retry', async () => {
  const fetcher = vi.fn().mockRejectedValue(new Error('timeout')); vi.stubGlobal('fetch', fetcher);
  await expect(sendMessage('owner', input)).rejects.toThrow('timeout');
  expect(db.metaDelivery.update.mock.calls[0][0].data).toEqual({ status: 'UNKNOWN' }); expect(fetcher).toHaveBeenCalledTimes(1);
});
it('rejects another owner dog before touching connection or provider', async () => {
  db.dog.findFirst.mockResolvedValue(null);
  await expect(sendMessage('owner', input)).rejects.toThrow('dog owned'); expect(db.metaConnection.findFirst).not.toHaveBeenCalled();
});
it('requires a configured approved WhatsApp template outside the reply window', async () => {
  const current = await db.metaConnection.findFirst(); db.metaConnection.findFirst.mockResolvedValue({ ...current, platform: 'whatsapp', scopes: ['whatsapp_business_messaging'], token: encrypt('private-token', 'owner:whatsapp:123') });
  db.metaContact.findFirst.mockResolvedValue({ externalId: '15555555555', optedInAt: new Date(), lastInboundAt: new Date(0) });
  await expect(sendMessage('owner', { ...input, text: undefined, template: 'unapproved', language: 'en_US' })).rejects.toThrow('not approved');
  vi.stubEnv('META_WHATSAPP_TEMPLATES', 'hello_world:en_US'); const fetcher = vi.fn().mockResolvedValue(Response.json({ messages: [{ id: 'wa1' }] })); vi.stubGlobal('fetch', fetcher);
  await sendMessage('owner', { ...input, text: undefined, template: 'hello_world', language: 'en_US' });
  expect(JSON.parse(fetcher.mock.calls[0][1].body).template.name).toBe('hello_world');
});
