import { PrismaClient } from '@prisma/client';

// Operator task: dry-run by default. Configure the environment explicitly;
// this script never reads production credentials from a fallback or writes logs containing tokens.
const apply = process.argv.includes('--apply');
if (!process.env.DATABASE_URL) throw new Error('Set the intended DATABASE_URL explicitly.');
const db = new PrismaClient();
const now = new Date();
const old = new Date(Date.now() - 30 * 86400000);
const filters = {
  metaOAuthState: { expiresAt: { lt: now } },
  metaRateBucket: { expiresAt: { lt: now } },
  metaShare: { expiresAt: { lt: now } },
  metaWebhook: { receivedAt: { lt: old } },
  metaContact: { lastInboundAt: { lt: old } }
};
try {
  const result = {};
  for (const [model, where] of Object.entries(filters)) {
    result[model] = apply ? (await db[model].deleteMany({ where })).count : await db[model].count({ where });
  }
  // Delivery idempotency tombstones are never automatically deleted. Keep
  // UNKNOWN/PENDING attempts until reconciled and maintain the dedup retry contract.
  console.log(JSON.stringify({ mode: apply ? 'applied' : 'dry-run', rows: result }));
} finally { await db.$disconnect(); }
