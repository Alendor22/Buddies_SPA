import { PrismaClient } from '@prisma/client';
import { expect, test } from '@playwright/test';
import { hashTestPassword } from '../support/password';

const prisma = new PrismaClient();
let testEmail = '';

test.afterEach(async () => {
  if (testEmail) {
    await prisma.user.deleteMany({ where: { email: testEmail } });
    testEmail = '';
  }
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

test('creates a dog identity and exposes an owner-safe public profile', async ({ browser, page }) => {
  const suffix = Date.now().toString(36);
  testEmail = 'e2e-' + suffix + '@example.test';
  const dogName = 'Journey ' + suffix;

  await prisma.user.create({
    data: {
      displayName: 'E2E Dog Parent',
      email: testEmail,
      passwordHash: hashTestPassword('test-password-123'),
      emailVerifiedAt: new Date()
    }
  });

  await page.goto('/auth/login');
  await page.getByLabel('Email').fill(testEmail);
  await page.getByLabel('Password').fill('test-password-123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto('/dogs/new');
  await page.getByLabel('Name').fill(dogName);
  await page.getByLabel('Breed').fill('Mixed breed');
  await page.getByLabel('Weight lb').fill('42');
  await page.getByLabel('Temperament').fill('Calm and social');
  await page.getByRole('button', { name: 'Create dog profile' }).click();

  await expect(page).toHaveURL(/\/dogs\/[^?]+\?created=1$/);
  await expect(page.getByRole('heading', { level: 1, name: dogName })).toBeVisible();
  await expect(page.getByText('Managed by you')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Edit' })).toBeVisible();

  const publicProfileUrl = page.url().replace(/\?created=1$/, '');
  await page.getByRole('link', { name: 'Show QR Code' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Code for ' + dogName })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Buddies public profile QR code' })).toBeVisible();

  const anonymous = await browser.newContext();
  const anonymousPage = await anonymous.newPage();
  await anonymousPage.goto(publicProfileUrl);

  await expect(anonymousPage.getByRole('heading', { level: 1, name: dogName })).toBeVisible();
  await expect(anonymousPage.getByText('Owner details hidden')).toBeVisible();
  await expect(anonymousPage.getByRole('link', { name: 'Edit' })).toHaveCount(0);
  await expect(anonymousPage.getByText('Emergency contact')).toHaveCount(0);

  await anonymous.close();
});
