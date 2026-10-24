import { expect, test } from '@playwright/test';

import { createTestPrismaClient } from '../support/test-database';
const prisma = createTestPrismaClient();
const clerkApiBase = 'https://api.clerk.com/v1';
let clerkUserId = '';
let buddiesUserId = '';
let testEmail = '';

async function clerkApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    throw new Error('CLERK_SECRET_KEY is required for Clerk end-to-end tests');
  }

  const response = await fetch(`${clerkApiBase}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
      ...init.headers
    }
  });

  if (!response.ok) {
    throw new Error(
      `Clerk API ${init.method ?? 'GET'} ${path} failed with HTTP ${response.status}: ${await response.text()}`
    );
  }

  return response.json() as Promise<T>;
}

async function createClerkUser(email: string, password: string) {
  return clerkApi<{ id: string }>('/users', {
    method: 'POST',
    body: JSON.stringify({
      email_address: [email],
      password,
      first_name: 'Clerk',
      last_name: 'Journey'
    })
  });
}

async function createSignInTicket(userId: string) {
  return clerkApi<{ token: string }>('/sign_in_tokens', {
    method: 'POST',
    body: JSON.stringify({
      user_id: userId,
      expires_in_seconds: 300
    })
  });
}

async function deleteClerkUser(userId: string) {
  if (!userId) return;
  await clerkApi(`/users/${userId}`, { method: 'DELETE' }).catch(() => undefined);
}

test.afterEach(async () => {
  if (buddiesUserId) {
    await prisma.user.deleteMany({ where: { id: buddiesUserId } });
  }
  await deleteClerkUser(clerkUserId);
  clerkUserId = '';
  buddiesUserId = '';
  testEmail = '';
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

test.describe('Clerk authentication', () => {
  test('renders the Clerk sign-in and sign-up experiences', async ({ page }) => {
    await page.goto('/sign-in');
    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.getByText(/sign in/i).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /continue with google/i })).toBeVisible();

    await page.goto('/sign-up');
    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.getByText(/create your account/i).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /continue with google/i })).toBeVisible();
  });

  test('authenticates with Clerk, links the existing Buddies identity, and signs out', async ({ page }) => {
    const suffix = Date.now().toString(36);
    testEmail = `e2e+clerk_test_${suffix}@example.com`;
    const password = 'Buddies-clerk-test-123!';

    const buddiesUser = await prisma.user.create({
      data: {
        displayName: 'Existing Buddies Parent',
        email: testEmail,
        emailVerifiedAt: new Date()
      }
    });
    buddiesUserId = buddiesUser.id;

    const clerkUser = await createClerkUser(testEmail, password);
    clerkUserId = clerkUser.id;
    const ticket = await createSignInTicket(clerkUserId);

    await page.goto(
      `/sign-in?__clerk_ticket=${encodeURIComponent(ticket.token)}&redirect_url=${encodeURIComponent('/dashboard')}`
    );
    await expect(page).toHaveURL(/\/dashboard(?:\?|$)/, { timeout: 30_000 });
    await expect(page.getByText(/dashboard/i).first()).toBeVisible();

    await expect.poll(async () => {
      const linked = await prisma.user.findUnique({
        where: { id: buddiesUserId },
        select: { clerkId: true }
      });
      return linked?.clerkId;
    }).toBe(clerkUserId);

    await page.goto('/logout');
    await expect(page).toHaveURL(/\/$/, { timeout: 30_000 });
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/sign-in(?:\/|\?|$)/);
  });
});
