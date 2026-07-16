// spec: specs/api-integration-session-storage.plan.md
// seed: tests/seed.spec.ts
// test case: 2.3. Verify the header reflects the authenticated identity immediately after storageState is applied, with no flash of the logged-out 'Sign in' state

import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@fixtures/fixtures';

test.describe('Bypassing the Login UI', () => {
  test("Verify the header reflects the authenticated identity immediately after storageState is applied, with no flash of the logged-out 'Sign in' state", async ({
    page,
    request,
    browser,
  }) => {
    const storageStatePath = path.join(
      'test-results',
      'storage-state',
      'no-login-flash.json',
    );

    // Build the shared storageState the same way as the other auth-reuse spec files.
    const loginResponse = await request.post('https://api.practicesoftwaretesting.com/users/login', {
      data: { email: 'customer@practicesoftwaretesting.com', password: 'welcome01' },
    });
    expect(loginResponse.status()).toBe(200);
    const { access_token: accessToken } = await loginResponse.json();
    await page.goto('https://practicesoftwaretesting.com/');
    await page.evaluate((token) => localStorage.setItem('auth-token', token), accessToken as string);
    await page.context().storageState({ path: storageStatePath });
    await page.close();

    const context = await browser.newContext({ storageState: storageStatePath });
    const homePage = await context.newPage();

    // Track every GET /users/me response from the moment storageState is applied so a transient
    // 401 (the "flash of logged-out state") would be caught even if the UI settles to the right state.
    const meResponseStatuses: number[] = [];
    homePage.on('response', (response) => {
      if (
        response.url() === 'https://api.practicesoftwaretesting.com/users/me' &&
        response.request().method() === 'GET'
      ) {
        meResponseStatuses.push(response.status());
      }
    });

    // 1. Using the shared storageState, navigate to 'https://practicesoftwaretesting.com/'
    await homePage.goto('https://practicesoftwaretesting.com/');
    await expect(homePage.getByRole('menuitem', { name: 'Jane Doe' })).toBeVisible();
    expect(meResponseStatuses.length).toBeGreaterThan(0);
    expect(meResponseStatuses.every((status) => status === 200)).toBe(true);

    // 2. Navigate to a second page, e.g. 'https://practicesoftwaretesting.com/product/' plus the id of the
    // first product returned by GET /products, obtained at runtime via APIRequestContext rather than hardcoded
    const productsResponse = await request.get('https://api.practicesoftwaretesting.com/products');
    expect(productsResponse.status()).toBe(200);
    const { data: products } = await productsResponse.json();
    const firstProduct = products[0];

    await homePage.goto(`https://practicesoftwaretesting.com/product/${firstProduct.id}`);
    await expect(homePage.getByRole('heading', { name: firstProduct.name, level: 1 })).toBeVisible();
    await expect(homePage.getByRole('menuitem', { name: 'Jane Doe' })).toBeVisible();

    await context.close();
    fs.rmSync(storageStatePath, { force: true });
  });
});
