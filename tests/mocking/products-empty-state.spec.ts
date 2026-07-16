// spec: specs/api-integration-session-storage.plan.md
// seed: tests/seed.spec.ts
// test case: 4.1. Mock GET /products to return an empty list and verify the home page's empty state

import { test, expect } from '@fixtures/fixtures';
import { mockOnlyForMethod } from '@support/steps';

test.describe('Network Interception / Mocking', () => {
  test("Mock GET /products to return an empty list and verify the home page's empty state", async ({
    page,
    homePage,
  }) => {
    // 1. Before navigating, register a page.route interceptor for the pattern matching GET /products
    // (and its query string) that fulfills with status 200 and an empty product list.
    // Confirmed live: the home page's real product listing request uses the non-standard HTTP
    // "QUERY" method (like /products/search), not GET, and the real paginated response shape is
    // flat (current_page/data/from/last_page/per_page/to/total) rather than nested under a "meta"
    // key as the plan's illustrative example suggested - the mock below matches the real shape
    // with an empty "data" array and a single, empty page.
    await page.route(
      '**/products*',
      mockOnlyForMethod('QUERY', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            current_page: 1,
            data: [],
            from: null,
            last_page: 1,
            per_page: 9,
            to: null,
            total: 0,
          }),
        });
      }),
    );

    // 2. Navigate to 'https://practicesoftwaretesting.com/'
    // Note: the products QUERY call fires asynchronously after Angular bootstraps, which can
    // happen after page.goto's own 'load' event resolves - so the intercepted response is awaited
    // explicitly instead of checking a boolean flag immediately after navigation (a race that
    // failed intermittently in an earlier version of this test).
    const productsResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/products') &&
        !response.url().includes('/products/search') &&
        response.request().method() === 'QUERY',
    );
    await page.goto('/');
    const productsResponse = await productsResponsePromise;
    expect(productsResponse.status()).toBe(200);
    // No product cards are rendered for the mocked empty list.
    await expect(homePage.getProductCards()).toHaveCount(0);
    // Confirmed live (via a real search with 0 matches, which renders the same shared empty-state message):
    // the app shows a "There are no products found." message instead of the product grid.
    await expect(homePage.getEmptyStateText()).toBeVisible();
    // Confirmed live: pagination controls are not rendered at all when the product list is empty, so no
    // second page button exists - i.e. no more than 1 page is shown.
    await expect(homePage.getPaginationButton('Page-2')).toBeHidden();
  });
});
