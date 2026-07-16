import { APIRequestContext, Page, Route, expect } from '@playwright/test';

type Product = { id: string; in_stock: boolean };

/**
 * Wraps a page.route mock handler so it only fulfills requests using the given HTTP method,
 * letting any other method through untouched via route.continue(). Keeps the method-filtering
 * conditional out of test bodies, per eslint-plugin-playwright's no-conditional-in-test rule.
 */
export function mockOnlyForMethod(method: string, fulfill: (route: Route) => Promise<void>) {
  return async (route: Route) => {
    const isMatchingMethod = route.request().method() === method;
    return isMatchingMethod ? fulfill(route) : route.continue();
  };
}

/**
 * Registers a console listener and returns the accumulating array of error-level message texts,
 * keeping the type-check conditional out of test bodies (same eslint rule as above).
 */
export function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    const isError = message.type() === 'error';
    if (isError) errors.push(message.text());
  });
  return errors;
}

/**
 * Stock levels on practicesoftwaretesting.com rotate over time, and an entire
 * page of results can be "Out of stock" (Add to cart stays disabled), so this
 * searches across pages rather than assuming page 1 has one.
 */
export async function findInStockProduct(request: APIRequestContext): Promise<Product> {
  const firstPageResponse = await request.get('https://api.practicesoftwaretesting.com/products');
  expect(firstPageResponse.status()).toBe(200);
  const firstPage = await firstPageResponse.json();

  for (let pageNum = 1; pageNum <= firstPage.last_page; pageNum++) {
    const { data } =
      pageNum === 1
        ? firstPage
        : await (
            await request.get(`https://api.practicesoftwaretesting.com/products?page=${pageNum}`)
          ).json();
    const inStockProduct = data.find((p: Product) => p.in_stock);
    if (inStockProduct) return inStockProduct;
  }

  throw new Error('Expected at least one in-stock product across all pages');
}
