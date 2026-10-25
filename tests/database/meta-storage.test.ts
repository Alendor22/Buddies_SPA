import { afterAll, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { uniqueTestId } from '../support/unique';
const db = new PrismaClient();
afterAll(() => db.$disconnect());
it('enforces asset uniqueness, OAuth single use, delivery idempotency and cascaded deletion', async () => {
  const owner = await db.user.create({ data: { email: uniqueTestId('meta') + '@example.test', displayName: 'Meta test' } });
  const externalId = uniqueTestId('asset');
  try {
    const dog = await db.dog.create({ data: { ownerId: owner.id, name: 'Meta Dog', slug: uniqueTestId('meta-dog') } });
    const connection = await db.metaConnection.create({ data: { ownerId: owner.id, platform: 'facebook', externalId, providerUserId: '123', label: 'Test', token: 'encrypted-fixture', scopes: [], expiresAt: new Date(Date.now() + 60000) } });
    await expect(db.metaConnection.create({ data: { ownerId: owner.id, platform: 'facebook', externalId, providerUserId: '123', label: 'Duplicate', token: 'encrypted-fixture', scopes: [], expiresAt: new Date() } })).rejects.toMatchObject({ code: 'P2002' });
    const stateId = uniqueTestId('state');
    await db.metaOAuthState.create({ data: { hash: stateId, ownerId: owner.id, browserHash: 'browser', purpose: 'facebook', expiresAt: new Date(Date.now() + 60000) } });
    const claims = await Promise.all([1, 2].map(() => db.metaOAuthState.deleteMany({ where: { hash: stateId, ownerId: owner.id } })));
    expect(claims.reduce((total, claim) => total + claim.count, 0)).toBe(1);
    const deliveryId = uniqueTestId('delivery');
    await db.metaDelivery.create({ data: { id: deliveryId, connectionId: connection.id, senderDogId: dog.id } });
    await expect(db.metaDelivery.create({ data: { id: deliveryId, connectionId: connection.id, senderDogId: dog.id } })).rejects.toMatchObject({ code: 'P2002' });
    await db.metaContact.create({ data: { connectionId: connection.id, externalId: '456', lastInboundAt: new Date() } });
    await db.metaConnection.delete({ where: { id: connection.id } });
    expect(await db.metaContact.count({ where: { connectionId: connection.id } })).toBe(0);
    expect(await db.metaDelivery.count({ where: { id: deliveryId } })).toBe(0);
  } finally { await db.user.delete({ where: { id: owner.id } }); }
});
