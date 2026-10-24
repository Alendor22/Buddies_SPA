import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { DogPresenceStatus, PrismaClient } from '@/generated/prisma/client';
import { uniqueTestId } from '../support/unique';

const prisma = new PrismaClient();
const testEmails = new Set<string>();

async function createOwner(label: string) {
  const email = uniqueTestId(label) + '@example.test';
  testEmails.add(email);
  return prisma.user.create({
    data: {
      email,
      displayName: 'Test Owner',
      emailVerifiedAt: new Date()
    }
  });
}

afterEach(async () => {
  if (!testEmails.size) return;
  await prisma.user.deleteMany({ where: { email: { in: Array.from(testEmails) } } });
  testEmails.clear();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('migrated PostgreSQL invariants', () => {
  it('enforces normalized dog-name uniqueness per owner', async () => {
    const owner = await createOwner('dog-name-owner');
    await prisma.dog.create({
      data: { ownerId: owner.id, name: ' Luna ', slug: uniqueTestId('luna') }
    });

    await expect(prisma.dog.create({
      data: { ownerId: owner.id, name: 'luna', slug: uniqueTestId('luna-duplicate') }
    })).rejects.toMatchObject({ code: 'P2002' });
  });

  it('allows the same normalized dog name for different owners', async () => {
    const firstOwner = await createOwner('first-owner');
    const secondOwner = await createOwner('second-owner');

    const [first, second] = await Promise.all([
      prisma.dog.create({
        data: { ownerId: firstOwner.id, name: 'Luna', slug: uniqueTestId('first-luna') }
      }),
      prisma.dog.create({
        data: { ownerId: secondOwner.id, name: ' luna ', slug: uniqueTestId('second-luna') }
      })
    ]);

    expect(first.ownerId).not.toBe(second.ownerId);
  });

  it('permits only one live presence row per dog', async () => {
    const owner = await createOwner('presence-owner');
    const dog = await prisma.dog.create({
      data: { ownerId: owner.id, name: 'Scout', slug: uniqueTestId('scout') }
    });
    const expiresAt = new Date(Date.now() + 60_000);

    await prisma.dogPresence.create({
      data: {
        dogId: dog.id,
        ownerId: owner.id,
        status: DogPresenceStatus.WALKING,
        latitude: 40,
        longitude: -74,
        expiresAt
      }
    });

    await expect(prisma.dogPresence.create({
      data: {
        dogId: dog.id,
        ownerId: owner.id,
        status: DogPresenceStatus.PAUSED,
        latitude: 40.1,
        longitude: -74.1,
        expiresAt
      }
    })).rejects.toMatchObject({ code: 'P2002' });
  });

  it('cascades owner deletion through owned dog records', async () => {
    const owner = await createOwner('cascade-owner');
    const dog = await prisma.dog.create({
      data: { ownerId: owner.id, name: 'Milo', slug: uniqueTestId('milo') }
    });

    await prisma.user.delete({ where: { id: owner.id } });
    testEmails.delete(owner.email);

    await expect(prisma.dog.findUnique({ where: { id: dog.id } })).resolves.toBeNull();
  });
});
