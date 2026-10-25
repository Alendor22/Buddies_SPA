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

function isProtectedRoute(route: string) {
  return (
    route.startsWith('/dashboard') ||
    route.startsWith('/dogs/new') ||
    route.startsWith('/dogs/edit') ||
    route.startsWith('/logout')
  );
}

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

test.describe('anonymous public route verification', () => {
  for (const template of routeTemplates) {
    const route = materializePageRoute(template, parameters);
    if (isProtectedRoute(route)) continue;

    test(`${template} resolves to its expected public state`, async ({ request, page }) => {
      if (route.startsWith('/share/meta/')) {
        await page.goto(route);
        await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
        await expect(page.getByText('Shared with permission.', { exact: false })).toHaveCount(0);
        return;
      }
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
