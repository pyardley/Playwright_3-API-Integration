// spec: specs/api-integration-session-storage.plan.md
// seed: tests/seed.spec.ts
// test case: 4.2. Mock GET /products to return a 500 error and verify an error state is shown

import { test, expect } from '@fixtures/fixtures';
import { mockOnlyForMethod, collectConsoleErrors } from '@support/steps';

test.describe('Network Interception / Mocking', () => {
  test('Mock GET /products to return a 500 error and verify an error state is shown', async ({
    page,
    homePage,
  }) => {
    const consoleErrors = collectConsoleErrors(page);

    // 1. Register a page.route interceptor for '**/products*' that fulfills with status 500 and a JSON body
    // Confirmed live: the home page's product listing request uses the non-standard HTTP "QUERY"
    // method, not GET.
    await page.route(
      '**/products*',
      mockOnlyForMethod('QUERY', async (route) => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Internal Server Error' }),
        });
      }),
    );

    // 2. Navigate to 'https://practicesoftwaretesting.com/'
    await page.goto('/');

    // The mocked 500 response is received by the page, confirmed via the browser's own
    // "Failed to load resource" console error for that request.
    await expect
      .poll(() => consoleErrors.some((text) => /Failed to load resource.*500/.test(text)))
      .toBe(true);
    // The product grid does not display any product cards, since no real data was returned.
    await expect(homePage.getProductCards()).toHaveCount(0);

    // The rest of the page (header, sidebar filters, footer) still renders without crashing.
    await expect(homePage.header.getMainMenu()).toBeVisible();
    await expect(homePage.getFiltersHeading()).toBeVisible();
    await expect(homePage.getFooterText()).toBeVisible();
  });
});
