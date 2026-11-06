import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

type CleanupAction = {
  name: string;
  count: () => Promise<number>;
  remove: () => Promise<number>;
};

// Operator task: dry-run by default. Configure the environment explicitly;
// this script never reads production credentials from a fallback or writes logs containing tokens.
const apply = process.argv.includes('--apply');
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('Set the intended DATABASE_URL explicitly.');
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
const now = new Date();
const old = new Date(Date.now() - 30 * 86400000);
const actions: CleanupAction[] = [
  { name: 'metaOAuthState', count: () => db.metaOAuthState.count({ where: { expiresAt: { lt: now } } }), remove: async () => (await db.metaOAuthState.deleteMany({ where: { expiresAt: { lt: now } } })).count },
  { name: 'metaRateBucket', count: () => db.metaRateBucket.count({ where: { expiresAt: { lt: now } } }), remove: async () => (await db.metaRateBucket.deleteMany({ where: { expiresAt: { lt: now } } })).count },
  { name: 'metaShare', count: () => db.metaShare.count({ where: { expiresAt: { lt: now } } }), remove: async () => (await db.metaShare.deleteMany({ where: { expiresAt: { lt: now } } })).count },
  { name: 'metaWebhook', count: () => db.metaWebhook.count({ where: { receivedAt: { lt: old } } }), remove: async () => (await db.metaWebhook.deleteMany({ where: { receivedAt: { lt: old } } })).count },
  { name: 'metaContact', count: () => db.metaContact.count({ where: { lastInboundAt: { lt: old } } }), remove: async () => (await db.metaContact.deleteMany({ where: { lastInboundAt: { lt: old } } })).count }
];

try {
  const rows: Record<string, number> = {};
  for (const action of actions) rows[action.name] = apply ? await action.remove() : await action.count();
  // Delivery idempotency tombstones are never automatically deleted. Keep
  // UNKNOWN/PENDING attempts until reconciled and maintain the dedup retry contract.
  console.log(JSON.stringify({ mode: apply ? 'applied' : 'dry-run', rows }));
} finally {
  await db.$disconnect();
}
