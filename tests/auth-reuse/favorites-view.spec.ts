// spec: specs/api-integration-session-storage.plan.md
// seed: tests/seed.spec.ts

import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@fixtures/fixtures';

test.describe('Bypassing the Login UI', () => {
  test('Independently reuses the same storageState to view Favorites (separate spec file B)', async ({
    page,
    request,
    browser,
  }) => {
    const storageStatePath = path.join(
      'test-results',
      'storage-state',
      'favorites-view.json',
    );

    // 1. In a completely separate spec file from Test file A, configure the test to use the same storageState file
    // (built independently here, since each spec file only depends on the storageState file on disk, not on
    // any in-memory state from account-overview.spec.ts).
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

    // 2. Navigate directly to 'https://practicesoftwaretesting.com/account/favorites'
    const favoritesResponsePromise = favoritesPage.waitForResponse(
      (response) =>
        response.url() === 'https://api.practicesoftwaretesting.com/favorites' &&
        response.request().method() === 'GET',
    );
    await favoritesPage.goto('https://practicesoftwaretesting.com/account/favorites');
    await expect(favoritesPage).toHaveTitle(/^Favorites - Practice Software Testing - Toolshop/);
    await expect(favoritesPage.getByRole('heading', { name: 'Favorites', level: 1 })).toBeVisible();
    const favoritesResponse = await favoritesResponsePromise;
    expect(favoritesResponse.status()).toBe(200);
    const favorites = await favoritesResponse.json();
    expect(favorites.length).toBeGreaterThan(0);
    const targetFavorite = favorites[0];
    await expect(favoritesPage.getByRole('heading', { name: targetFavorite.product.name })).toBeVisible();

    // 3. Click the button on a favorite item that removes it from favorites (the small icon button next to each favorite entry)
    // The remove button exposes no accessible name, so it is located via the button's role scoped to its
    // uniquely-identified favorite card container (data-test="favorite-{id}").
    const targetCard = favoritesPage.locator(`[data-test="favorite-${targetFavorite.id}"]`);
    const deleteResponsePromise = favoritesPage.waitForResponse(
      (response) =>
        response.url() === `https://api.practicesoftwaretesting.com/favorites/${targetFavorite.id}` &&
        response.request().method() === 'DELETE',
    );
    await targetCard.getByRole('button').click();
    const deleteResponse = await deleteResponsePromise;
    expect(deleteResponse.status()).toBeLessThan(300);
    await expect(favoritesPage.getByRole('heading', { name: targetFavorite.product.name })).toBeHidden();

    // Cleanup: restore the removed favorite via the API so repeat runs keep seeing the same favorites list.
    const restoreResponse = await request.post('https://api.practicesoftwaretesting.com/favorites', {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: { product_id: targetFavorite.product_id },
    });
    expect(restoreResponse.status()).toBe(201);

    await context.close();
    fs.rmSync(storageStatePath, { force: true });
  });
});
