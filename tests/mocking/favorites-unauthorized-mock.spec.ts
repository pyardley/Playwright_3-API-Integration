// spec: specs/api-integration-session-storage.plan.md
// seed: tests/seed.spec.ts
// test case: 4.6. Mock GET /favorites to return 401 while the UI expects an authenticated user, verify graceful handling

import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@fixtures/fixtures';
import { mockOnlyForMethod } from '@support/steps';

test.describe('Network Interception / Mocking', () => {
  test('Mock GET /favorites to return 401 while the UI expects an authenticated user, verify graceful handling', async ({
    page,
    request,
    browser,
  }) => {
    const storageStatePath = path.join(
      'test-results',
      'storage-state',
      'favorites-unauthorized-mock.json',
    );

    // Build a real, otherwise-valid authenticated storageState first, following the established
    // login -> inject token -> persist pattern used across Suite 1/2.
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
    const favoritesPage = await context.newPage();
    const pageErrors: Error[] = [];
    favoritesPage.on('pageerror', (error) => pageErrors.push(error));

    // 1. Using the authenticated storageState, register a page.route interceptor for '**/favorites' that
    // fulfills with status 401, overriding the real (otherwise-200) response.
    // Note: confirmed live that a loose '**/favorites' pattern also matches the app's own page
    // navigation to https://practicesoftwaretesting.com/account/favorites (which also ends in
    // "favorites"), hijacking the document load itself instead of just the backend API call. The
    // pattern is scoped to the API origin so only the intended XHR/fetch request is intercepted.
    await favoritesPage.route(
      'https://api.practicesoftwaretesting.com/favorites',
      mockOnlyForMethod('GET', async (route) => {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Unauthorized' }),
        });
      }),
    );

    // 2. Navigate to 'https://practicesoftwaretesting.com/account/favorites'
    const favoritesResponsePromise = favoritesPage.waitForResponse(
      (response) =>
        response.url() === 'https://api.practicesoftwaretesting.com/favorites' &&
        response.request().method() === 'GET',
    );
    await favoritesPage.goto('https://practicesoftwaretesting.com/account/favorites');
    const favoritesResponse = await favoritesResponsePromise;
    expect(favoritesResponse.status()).toBe(401);

    // No favorite product cards are displayed for the mocked-unauthorized response.
    await expect(favoritesPage.locator('[data-test^="favorite-"]')).toHaveCount(0);

    // Confirmed live: the app's global auth handling treats any 401 - even one that is only mocked on this
    // single endpoint, with an otherwise-valid stored token - as "logged out" and redirects away to the
    // login page, clearing the authenticated header state. This is a graceful fallback (a redirect) rather
    // than an unhandled crash, even though the user's stored token is otherwise valid.
    await expect(favoritesPage).toHaveURL(/\/auth\/login$/);
    await expect(favoritesPage.getByRole('menuitem', { name: 'Sign in' })).toBeVisible();
    expect(pageErrors, 'No unhandled exception/crash should occur from the mocked 401').toEqual([]);

    await context.close();
    fs.rmSync(storageStatePath, { force: true });
  });
});
