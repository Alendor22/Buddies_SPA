import { DogStatus, PrismaClient } from '@prisma/client';
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { discoverPageRouteTemplates, materializePageRoute } from '../support/app-routes';

const prisma = new PrismaClient();
const manifest = JSON.parse(readFileSync('tests/test-suite.manifest.json', 'utf8')) as {
  routeState200: { dynamicParameters: Record<string, string> };
};
const parameters = manifest.routeState200.dynamicParameters;
const routeTemplates = discoverPageRouteTemplates();
const fixtureEmail = 'route-state-200@example.test';
let fixtureUserId = '';

test.beforeAll(async () => {
  await prisma.user.deleteMany({ where: { email: fixtureEmail } });
  const user = await prisma.user.create({
    data: {
      displayName: 'Route State Harness',
      email: fixtureEmail,
      emailVerifiedAt: new Date()
    }
  });
  fixtureUserId = user.id;
  await prisma.dog.create({
    data: {
      ownerId: user.id,
      name: 'Route State Dog',
      slug: parameters.slug,
      publicId: parameters.publicId,
      status: DogStatus.LOST,
      lostSince: new Date(),
      lastSeenLocation: 'Test fixture location'
    }
  });
});

test.afterAll(async () => {
  if (fixtureUserId) await prisma.user.deleteMany({ where: { id: fixtureUserId } });
  await prisma.$disconnect();
});

test.describe('route-state-200 verification', () => {
  for (const template of routeTemplates) {
    const route = materializePageRoute(template, parameters);

    test(`${template} resolves to a final HTTP 200 state`, async ({ request }) => {
      const response = await request.get(route, {
        failOnStatusCode: false,
        maxRedirects: 10
      });

      expect(
        response.status(),
        `${route} finished at ${response.url()} with HTTP ${response.status()}`
      ).toBe(200);
    });
  }
});
