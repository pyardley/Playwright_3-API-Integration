// spec: specs/api-integration-session-storage.plan.md
// seed: tests/seed.spec.ts
// test case: 1.3. Global teardown cleans up the storageState artifact and any setup-created data

import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@fixtures/fixtures';

test.describe('Global Setup & Teardown', () => {
  test('Global teardown cleans up the storageState artifact and any setup-created data', async ({
    page,
    request,
  }) => {
    const storageStatePath = path.join(
      'test-results',
      'storage-state',
      'teardown-cleanup.json',
    );

    // 1. Run global setup as in the happy-path case to produce a storageState file and log in via API
    const loginResponse = await request.post('https://api.practicesoftwaretesting.com/users/login', {
      data: { email: 'customer@practicesoftwaretesting.com', password: 'welcome01' },
    });
    expect(loginResponse.status()).toBe(200);
    const { access_token: accessToken } = await loginResponse.json();
    await page.goto('https://practicesoftwaretesting.com/');
    await page.evaluate((token) => localStorage.setItem('auth-token', token), accessToken as string);
    await page.goto('https://practicesoftwaretesting.com/account');
    await page.context().storageState({ path: storageStatePath });
    expect(fs.existsSync(storageStatePath)).toBe(true);

    // 2. In global teardown, send a GET request via APIRequestContext to https://api.practicesoftwaretesting.com/users/logout, including the Authorization: Bearer <token> header captured during setup
    const logoutResponse = await request.get('https://api.practicesoftwaretesting.com/users/logout', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(logoutResponse.status()).toBe(200);

    // 3. Delete the storageState file written to disk during setup
    fs.rmSync(storageStatePath, { force: true });
    expect(fs.existsSync(storageStatePath)).toBe(false);
  });
});
