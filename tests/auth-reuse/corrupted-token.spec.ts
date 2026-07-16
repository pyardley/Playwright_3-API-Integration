// spec: specs/api-integration-session-storage.plan.md
// seed: tests/seed.spec.ts
// test case: 2.4. Negative: a storageState with a corrupted/expired auth-token value is treated as logged out

import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@fixtures/fixtures';
import { AccountPage } from '@pages/AccountPage';

test.describe('Bypassing the Login UI', () => {
  test('Negative: a storageState with a corrupted/expired auth-token value is treated as logged out', async ({
    page,
    request,
    browser,
  }) => {
    const validStorageStatePath = path.join(
      'test-results',
      'storage-state',
      'corrupted-token-valid.json',
    );
    const corruptedStorageStatePath = path.join(
      'test-results',
      'storage-state',
      'corrupted-token.json',
    );

    // Build a valid storageState first, following the established login -> inject token -> persist pattern.
    const loginResponse = await request.post('https://api.practicesoftwaretesting.com/users/login', {
      data: { email: 'customer@practicesoftwaretesting.com', password: 'welcome01' },
    });
    expect(loginResponse.status()).toBe(200);
    const { access_token: accessToken } = await loginResponse.json();
    await page.goto('https://practicesoftwaretesting.com/');
    await page.evaluate((token) => localStorage.setItem('auth-token', token), accessToken as string);
    await page.context().storageState({ path: validStorageStatePath });
    await page.close();

    // 1. Create a storageState object identical to the valid one, but replace the 'auth-token' localStorage value with an obviously invalid string (e.g. 'not-a-jwt')
    const savedState = JSON.parse(fs.readFileSync(validStorageStatePath, 'utf-8'));
    const origin = savedState.origins.find(
      (o: { origin: string }) => o.origin === 'https://practicesoftwaretesting.com',
    );
    expect(origin).toBeDefined();
    const authTokenEntry = origin.localStorage.find(
      (entry: { name: string }) => entry.name === 'auth-token',
    );
    expect(authTokenEntry).toBeDefined();
    authTokenEntry.value = 'not-a-jwt';
    fs.writeFileSync(corruptedStorageStatePath, JSON.stringify(savedState));
    expect(fs.existsSync(corruptedStorageStatePath)).toBe(true);

    // 2. Launch a new context using this corrupted storageState and navigate to 'https://practicesoftwaretesting.com/account'
    const context = await browser.newContext({ storageState: corruptedStorageStatePath });
    const sessionPage = await context.newPage();
    const accountPage = new AccountPage(sessionPage);
    const pageErrors: Error[] = [];
    sessionPage.on('pageerror', (error) => pageErrors.push(error));

    const meResponsePromise = sessionPage.waitForResponse(
      (response) =>
        response.url() === 'https://api.practicesoftwaretesting.com/users/me' &&
        response.request().method() === 'GET',
    );
    await sessionPage.goto('https://practicesoftwaretesting.com/account');
    const meResponse = await meResponsePromise;
    expect(meResponse.status()).toBe(401);
    await expect(accountPage.header.getSignInMenuItem()).toBeVisible();
    await expect(accountPage.header.getAccountMenuItem('Jane Doe')).toBeHidden();
    expect(pageErrors, 'No unhandled exception/crash should occur despite the malformed token').toEqual([]);

    await context.close();
    fs.rmSync(validStorageStatePath, { force: true });
    fs.rmSync(corruptedStorageStatePath, { force: true });
  });
});
