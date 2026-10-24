import { access, readFile } from 'node:fs/promises';
import process from 'node:process';

const phases = {
  'Phase 1': [
    'src/app/api/buddies/request/route.ts',
    'src/app/api/dog-buddies/respond/route.ts',
    'src/app/api/buddies/walk-invite/route.ts',
    'src/app/api/walk-invitations/respond/route.ts',
    'src/app/api/notifications/read/route.ts',
    'src/app/api/maps/directions/route.ts',
    'src/app/dashboard/lost/report/page.tsx',
    'src/app/dogs/[slug]/sighting/page.tsx',
    'src/app/dashboard/records/page.tsx'
  ],
  'Phase 2': [
    'src/components/WalkRoutePlanner.tsx',
    'src/app/api/walk-routes/favorites/route.ts',
    'src/app/api/check-ins/route.ts',
    'src/app/dashboard/check-ins/page.tsx',
    'src/app/api/walks/[id]/messages/route.ts',
    'src/app/api/walks/status/route.ts',
    'src/app/api/realtime/token/route.ts',
    'src/app/dashboard/messages/page.tsx',
    'src/lib/walkAccess.ts',
    'src/lib/walkVisibility.ts'
  ],
  'Phase 3': [
    'src/app/api/health/route.ts',
    'scripts/smoke-production.mjs',
    '.github/workflows/ci.yml',
    '.github/workflows/production-smoke.yml',
    'DEPLOYMENT.md',
    'next.config.mjs',
    'prisma/schema.prisma'
  ]
};

const failures = [];

async function requireFile(phase, path) {
  try {
    await access(path);
    console.log(`PASS ${phase}: ${path}`);
  } catch {
    failures.push(`${phase}: missing ${path}`);
  }
}

function assertIncludes(label, content, expected) {
  if (!content.includes(expected)) failures.push(`${label}: missing ${JSON.stringify(expected)}`);
}

function assertExcludes(label, content, forbidden) {
  if (content.includes(forbidden)) failures.push(`${label}: contains forbidden ${JSON.stringify(forbidden)}`);
}

for (const [phase, paths] of Object.entries(phases)) {
  for (const path of paths) await requireFile(phase, path);
}

const schema = await readFile('prisma/schema.prisma', 'utf8');
for (const model of ['DogBuddyRequest', 'DogBuddy', 'WalkInvitation', 'Notification', 'FavoriteRoute', 'Message', 'VetRecord']) {
  assertIncludes('Prisma schema', schema, `model ${model}`);
}
for (const field of ['routeGeometry', 'routeSteps', 'routeDistanceMiles', 'routeDurationMin']) {
  assertIncludes('Prisma walk route storage', schema, field);
}
assertIncludes('Prisma 7 generated client provider', schema, 'provider = "prisma-client"');
assertIncludes('Prisma 7 generated client output', schema, 'output   = "../src/generated/prisma"');

const prismaRuntime = await readFile('src/lib/db.ts', 'utf8');
assertIncludes('Prisma PostgreSQL driver adapter', prismaRuntime, "import { PrismaPg } from '@prisma/adapter-pg';");
assertIncludes('Prisma PostgreSQL driver adapter', prismaRuntime, 'new PrismaPg({ connectionString })');

const createDog = await readFile('src/app/dogs/new/page.tsx', 'utf8');
assertIncludes('Dog create', createDog, 'action={createDogAction}');
assertExcludes('Dog create', createDog, 'method="get"');

const legacyConfirm = await readFile('src/app/dogs/new/confirm/page.tsx', 'utf8');
assertExcludes('Legacy dog confirmation', legacyConfirm, 'prisma.dog.create');

const editDog = await readFile('src/app/dogs/edit/page.tsx', 'utf8');
assertIncludes('Dog edit', editDog, 'method="post"');

const manageDog = await readFile('src/app/api/dogs/manage/route.ts', 'utf8');
assertExcludes('Dog manage GET', manageDog, 'handleManage(request, request.nextUrl.searchParams)');
assertIncludes('Dog manage POST', manageDog, 'export async function POST');

const walkAccess = await readFile('src/lib/walkAccess.ts', 'utf8');
assertIncludes('Walk access', walkAccess, 'WalkInvitationStatus.ACCEPTED');

const invitationResponse = await readFile('src/app/api/walk-invitations/respond/route.ts', 'utf8');
assertIncludes('Walk acceptance', invitationResponse, "walkerId: action === 'accept'");
assertIncludes('Walk invitation replay protection', invitationResponse, 'status: WalkInvitationStatus.PENDING');

const buddyResponse = await readFile('src/app/api/dog-buddies/respond/route.ts', 'utf8');
assertIncludes('Buddy request replay protection', buddyResponse, 'status: BuddyRequestStatus.PENDING');

const health = await readFile('src/app/api/health/route.ts', 'utf8');
assertIncludes('Deployment health', health, 'deploymentMetadata');
assertIncludes('Deployment readiness', health, 'databaseCheck');

const nextConfig = await readFile('next.config.mjs', 'utf8');
for (const header of ['Strict-Transport-Security', 'X-Frame-Options', 'X-Content-Type-Options']) {
  assertIncludes('Security headers', nextConfig, header);
}

if (failures.length) {
  console.error('\nPhase contract audit failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log('\nPhase 1, Phase 2, and Phase 3 contract audit passed.');
}
