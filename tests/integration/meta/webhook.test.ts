import { Prisma } from '@/generated/prisma/client';
import { createHmac } from 'node:crypto';
import { beforeEach, expect, it, vi } from 'vitest';
const db = vi.hoisted(() => ({ $transaction: vi.fn(), metaWebhook: { create: vi.fn(), findUnique: vi.fn() }, metaConnection: { findUnique: vi.fn() }, metaContact: { upsert: vi.fn(), updateMany: vi.fn() } }));
vi.mock('@/lib/db', () => ({ prisma: db }));
import { GET, POST } from '@/app/api/meta/webhook/route';
import { inboundEvents, processWebhook } from '@/lib/meta/webhook';
const timestamp = () => Date.now();
const payload = () => ({ object: 'page', entry: [{ id: '123', messaging: [{ sender: { id: '456' }, recipient: { id: '123' }, timestamp: timestamp(), message: { mid: 'm1', text: 'not persisted' } }] }] });
beforeEach(() => {
  vi.stubEnv('META_CORE_ENABLED', 'true'); vi.stubEnv('META_MESSAGING_ENABLED', 'true'); vi.stubEnv('META_APP_SECRET', 'test'); vi.stubEnv('META_WEBHOOK_VERIFY_TOKEN', 'verify-test');
  db.$transaction.mockImplementation(async callback => callback(db)); db.metaConnection.findUnique.mockResolvedValue({ id: 'connection', enabled: true });
});
it('requires the exact verify token', async () => {
  expect((await GET(new Request('https://app.test/api/meta/webhook?hub.mode=subscribe&hub.verify_token=verify-test&hub.challenge=123'))).status).toBe(200);
  expect((await GET(new Request('https://app.test/api/meta/webhook?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=123'))).status).toBe(403);
});
it('rejects forged delivery before touching storage', async () => {
  expect((await POST(new Request('https://app.test/api/meta/webhook', { method: 'POST', body: JSON.stringify(payload()) }))).status).toBe(403);
  expect(db.$transaction).not.toHaveBeenCalled();
});
it('commits signed delivery metadata and never stores text or automatic opt-in', async () => {
  const body = JSON.stringify(payload()); const signature = `sha256=${createHmac('sha256', 'test').update(body).digest('hex')}`;
  const result = await POST(new Request('https://app.test/api/meta/webhook', { method: 'POST', body, headers: { 'x-hub-signature-256': signature } }));
  expect(result.status).toBe(200);
  const created = db.metaContact.upsert.mock.calls[0][0].create;
  expect(created.externalId).toBe('456'); expect(created.optedInAt).toBeUndefined(); expect(JSON.stringify(created)).not.toContain('not persisted');
  expect(db.metaContact.updateMany.mock.calls[0][0].where.lastInboundAt.lt).toBeInstanceOf(Date);
});
it('does not acknowledge a failed database commit', async () => {
  db.$transaction.mockRejectedValue(new Error('offline'));
  const body = JSON.stringify(payload()); const signature = `sha256=${createHmac('sha256', 'test').update(body).digest('hex')}`;
  expect((await POST(new Request('https://app.test', { method: 'POST', body, headers: { 'x-hub-signature-256': signature } }))).status).toBe(503);
});
it('ignores echoes and wrong recipient assets', () => {
  const input = payload(); input.entry[0].messaging[0].recipient.id = '789'; expect(inboundEvents(input)).toEqual([]);
  expect(inboundEvents({ object: 'page', entry: [{ id: '123', messaging: [{ sender: { id: '456' }, recipient: { id: '123' }, timestamp: timestamp(), message: { mid: 'm1', is_echo: true } }] }] })).toEqual([]);
});
it('rejects stale callback timestamps', async () => {
  const input = payload(); input.entry[0].messaging[0].timestamp = Date.now() - 8 * 86400000; expect(inboundEvents(input)).toEqual([]);
  await processWebhook(Buffer.from(JSON.stringify(input))); expect(db.metaContact.upsert).not.toHaveBeenCalled();
});

it('acknowledges a duplicate only if its receipt actually committed', async () => {
  db.$transaction.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('duplicate', { code: 'P2002', clientVersion: '6' }));
  db.metaWebhook.findUnique.mockResolvedValue({ hash: 'committed-receipt' });
  await expect(processWebhook(Buffer.from(JSON.stringify(payload())))).resolves.toBeUndefined();
  db.metaWebhook.findUnique.mockResolvedValue(null);
  await expect(processWebhook(Buffer.from(JSON.stringify(payload())))).rejects.toMatchObject({ code: 'P2002' });
});
