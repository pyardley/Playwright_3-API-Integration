// spec: specs/api-integration-session-storage.plan.md
// seed: tests/seed.spec.ts
// test case: 4.5. Mock GET /carts/{cartId} to return a malformed/empty cart and verify checkout does not crash

import { test, expect } from '@fixtures/fixtures';
import { mockOnlyForMethod } from '@support/steps';

test.describe('Network Interception / Mocking', () => {
  test('Mock GET /carts/{cartId} to return a malformed/empty cart and verify checkout does not crash', async ({
    page,
    checkoutPage,
  }) => {
    const pageErrors: Error[] = [];
    page.on('pageerror', (error) => pageErrors.push(error));

    // 1. Register a page.route interceptor for the pattern '**/carts/*' (GET only) that fulfills with an
    // empty-but-well-formed cart.
    await page.route(
      '**/carts/*',
      mockOnlyForMethod('GET', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ id: 'mock-cart-id', cart_items: [] }),
        });
      }),
    );

    // 2. Set sessionStorage 'cart_id' to 'mock-cart-id' via page.evaluate and navigate to 'https://practicesoftwaretesting.com/checkout'
    await page.goto('/');
    await page.evaluate(() => {
      sessionStorage.setItem('cart_id', 'mock-cart-id');
      sessionStorage.setItem('cart_quantity', '0');
    });
    await page.goto('/checkout');

    // Confirmed live: without this mock, navigating to checkout with a cart id the real API can't resolve
    // reproduces the exact reported bug - a console error "Cannot read properties of undefined (reading
    // 'cart_items')" repeated dozens of times, and the Cart step renders completely blank (no table, no
    // buttons, nothing below the wizard steps). Note that a handful of these same "cart_items" console
    // errors are also observed transiently in the genuine, well-behaved case (before the async cart data
    // resolves), so their mere presence isn't itself a reliable crash signal - what matters is whether the
    // page ultimately settles into a real empty-cart UI (checked below) instead of staying blank forever.
    await expect(checkoutPage.getEmptyCartText()).toBeVisible();

    // Note: live exploration of the genuine empty-cart state (a real cart with 0 items) showed the app does
    // NOT render 'Continue Shopping' / 'Proceed to checkout' buttons when the cart is empty - only the
    // wizard steps and the empty-cart message are shown. The plan's expectation of visible buttons here does
    // not match that reality, so this assertion is adjusted to reflect the actual, observed behavior.
    await expect(checkoutPage.getProceedButton()).toBeHidden();
    await expect(checkoutPage.getContinueShoppingButton()).toBeHidden();

    expect(pageErrors, 'No unhandled exception/crash should occur despite the malformed cart mock').toEqual([]);
  });
});
