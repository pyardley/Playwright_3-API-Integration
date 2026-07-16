// spec: specs/api-integration-session-storage.plan.md
// seed: tests/seed.spec.ts

import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@fixtures/fixtures';

test.describe('Global Setup & Teardown', () => {
  test('Global setup authenticates via API and persists a working logged-in storageState', async ({
    page,
    request,
  }) => {
    const storageStatePath = path.join(
      'test-results',
      'storage-state',
      'api-login-storage-state.json',
    );

    // 1. In global setup, send a POST request via APIRequestContext to https://api.practicesoftwaretesting.com/users/login with body { email: 'customer@practicesoftwaretesting.com', password: 'welcome01' }
    const loginResponse = await request.post('https://api.practicesoftwaretesting.com/users/login', {
      data: { email: 'customer@practicesoftwaretesting.com', password: 'welcome01' },
    });
    expect(loginResponse.status()).toBe(200);
    const loginBody = await loginResponse.json();
    expect(typeof loginBody.access_token).toBe('string');
    // Note: the live API returns token_type as lowercase 'bearer', not 'Bearer' as the
    // plan's literal example suggests, so this assertion is deliberately case-insensitive.
    expect(loginBody.token_type.toLowerCase()).toBe('bearer');
    expect(typeof loginBody.expires_in).toBe('number');
    const accessToken = loginBody.access_token as string;

    // 2. Launch a browser, open a new page/context, and navigate to 'https://practicesoftwaretesting.com/' once so the origin exists in the browser storage
    await page.goto('https://practicesoftwaretesting.com/');
    await expect(page).toHaveTitle(/Practice Software Testing - Toolshop/);

    // 3. Using page.evaluate, call localStorage.setItem('auth-token', <access_token value from step 1>)
    await page.evaluate((token) => localStorage.setItem('auth-token', token), accessToken);

    // 4. Reload the page (or navigate to '/account')
    await page.goto('https://practicesoftwaretesting.com/account');
    await expect(page.getByRole('menuitem', { name: 'Jane Doe' })).toBeVisible();
    const meResponse = await request.get('https://api.practicesoftwaretesting.com/users/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(meResponse.status()).toBe(200);

    // 5. Call context.storageState({ path: <storage state file path> }) to persist the browser state to disk
    await page.context().storageState({ path: storageStatePath });
    const savedState = JSON.parse(fs.readFileSync(storageStatePath, 'utf-8'));
    const origin = savedState.origins.find(
      (o: { origin: string }) => o.origin === 'https://practicesoftwaretesting.com',
    );
    expect(origin).toBeDefined();
    const authTokenEntry = origin.localStorage.find(
      (entry: { name: string }) => entry.name === 'auth-token',
    );
    expect(authTokenEntry).toBeDefined();
    expect(authTokenEntry.value).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/);
    expect(authTokenEntry.value.startsWith('Bearer ')).toBe(false);

    // 6. Close the setup browser/context
    await page.context().close();
    expect(fs.existsSync(storageStatePath)).toBe(true);

    // Cleanup: remove the artifact this test produced so repeat runs start from a clean slate.
    fs.rmSync(storageStatePath, { force: true });
  });
});
