// spec: specs/api-integration-session-storage.plan.md
// seed: tests/seed.spec.ts
// test case: 2.1. Test file A: land directly on the account overview page using storageState, never touching the login form

import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@fixtures/fixtures';
import { AccountPage } from '@pages/AccountPage';

test.describe('Bypassing the Login UI', () => {
  test('Land directly on the account overview page using storageState, never touching the login form (spec file A)', async ({
    page,
    request,
    browser,
  }) => {
    const storageStatePath = path.join(
      'test-results',
      'storage-state',
      'account-overview.json',
    );

    // 1. Configure the test (or project) to use the storageState file produced by global setup
    const loginResponse = await request.post('https://api.practicesoftwaretesting.com/users/login', {
      data: { email: 'customer@practicesoftwaretesting.com', password: 'welcome01' },
    });
    expect(loginResponse.status()).toBe(200);
    const { access_token: accessToken } = await loginResponse.json();
    await page.goto('https://practicesoftwaretesting.com/');
    await page.evaluate((token) => localStorage.setItem('auth-token', token), accessToken as string);
    await page.context().storageState({ path: storageStatePath });
    await page.close();

    // A brand new, independent context/page consuming only the storageState file on disk -
    // this is the actual "reuse storageState" under test, never touching /auth/login.
    const context = await browser.newContext({ storageState: storageStatePath });
    const sessionPage = await context.newPage();
    const accountPage = new AccountPage(sessionPage);
    const visitedUrls: string[] = [];
    sessionPage.on('framenavigated', (frame) => {
      if (frame === sessionPage.mainFrame()) visitedUrls.push(frame.url());
    });

    // 2. Navigate directly to 'https://practicesoftwaretesting.com/account'
    await sessionPage.goto('https://practicesoftwaretesting.com/account');
    await expect(sessionPage).toHaveTitle(/^Overview - Practice Software Testing - Toolshop/);
    await expect(accountPage.getHeading()).toBeVisible();
    await expect(accountPage.getFavoritesButton()).toBeVisible();
    await expect(accountPage.getProfileButton()).toBeVisible();
    await expect(accountPage.getInvoicesButton()).toBeVisible();
    await expect(accountPage.getMessagesButton()).toBeVisible();
    await expect(accountPage.header.getAccountMenuItem('Jane Doe')).toBeVisible();

    // 3. Confirm no request to the login form/page ever occurred during this test by checking the browser's navigation history contains no '/auth/login' entry
    expect(visitedUrls.some((url) => url.includes('/auth/login'))).toBe(false);
    expect(visitedUrls.every((url) => url === 'https://practicesoftwaretesting.com/account')).toBe(true);
    expect(visitedUrls.length).toBeGreaterThan(0);

    await context.close();
    fs.rmSync(storageStatePath, { force: true });
  });
});
