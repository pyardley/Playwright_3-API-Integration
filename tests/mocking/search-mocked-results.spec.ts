// spec: specs/api-integration-session-storage.plan.md
// seed: tests/seed.spec.ts
// test case: 4.3. Mock GET /products/search to control search results and verify the result-count message

import { test, expect } from '@fixtures/fixtures';
import { mockOnlyForMethod } from '@support/steps';

test.describe('Network Interception / Mocking', () => {
  test('Mock GET /products/search to control search results and verify the result-count message', async ({
    page,
  }) => {
    const mockedProducts = [
      {
        id: 'MOCK0000000000000000000001',
        name: 'Mocked Combination Wrench',
        description: 'Fabricated product used only to verify the mocked search result count.',
        price: 19.99,
        is_location_offer: false,
        is_rental: false,
        co2_rating: 'A',
        in_stock: true,
        is_eco_friendly: true,
        product_image: {
          id: 'MOCKIMG0000000000000000001',
          by_name: 'Test Fixture',
          by_url: 'https://example.com',
          source_name: 'Test Fixture',
          source_url: 'https://example.com',
          file_name: 'placeholder.jpg',
          title: 'Mocked Combination Wrench',
        },
        category: { id: 'MOCKCAT00000000000000001', name: 'Wrench', slug: 'wrench' },
        brand: { id: 'MOCKBRAND0000000000000001', name: 'Mock Brand' },
      },
      {
        id: 'MOCK0000000000000000000002',
        name: 'Mocked Precision Screwdriver',
        description: 'Fabricated product used only to verify the mocked search result count.',
        price: 9.49,
        is_location_offer: false,
        is_rental: false,
        co2_rating: 'B',
        in_stock: true,
        is_eco_friendly: false,
        product_image: {
          id: 'MOCKIMG0000000000000000002',
          by_name: 'Test Fixture',
          by_url: 'https://example.com',
          source_name: 'Test Fixture',
          source_url: 'https://example.com',
          file_name: 'placeholder.jpg',
          title: 'Mocked Precision Screwdriver',
        },
        category: { id: 'MOCKCAT00000000000000002', name: 'Screwdriver', slug: 'screwdriver' },
        brand: { id: 'MOCKBRAND0000000000000001', name: 'Mock Brand' },
      },
    ];

    // 1. Register a page.route interceptor for '**/products/search*' that fulfills with 2 fabricated products.
    // Confirmed live: the app issues this request with the non-standard HTTP "QUERY" method (an empty query
    // string and a JSON body of { q: '<term>' }), not GET as the plan's literal wording suggests. The route
    // below still matches purely by URL (so the real request is intercepted either way); the method guard is
    // adjusted to the real "QUERY" method so a real GET to the same path (if any) would pass through untouched.
    await page.route(
      '**/products/search*',
      mockOnlyForMethod('QUERY', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            current_page: 1,
            data: mockedProducts,
            from: 1,
            last_page: 1,
            per_page: 9,
            to: mockedProducts.length,
            total: mockedProducts.length,
          }),
        });
      }),
    );

    // 2. Navigate to the home page, type 'Pliers' into the 'Search' textbox, and click the 'Search' button
    await page.goto('/');
    await page.getByRole('textbox', { name: 'Search' }).fill('Pliers');
    await page.getByRole('button', { name: 'Search' }).click();

    await expect(page.getByRole('heading', { name: 'Searched for: Pliers', level: 3 })).toBeVisible();
    // Matches the mocked count (2), not the real count (4) that this search term returns against live data.
    await expect(page.getByText("2 products found for 'Pliers'")).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Mocked Combination Wrench', level: 5 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Mocked Precision Screwdriver', level: 5 })).toBeVisible();
  });
});
