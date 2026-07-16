// spec: specs/api-integration-session-storage.plan.md
// seed: tests/seed.spec.ts
// test case: 3.2. Seed a cart via API before visiting checkout, verify the UI reflects it, then delete the cart

import { test, expect } from '@fixtures/fixtures';

test.describe('Playwright APIRequestContext for CRUD', () => {
  test('Seed a cart via API before visiting checkout, verify the UI reflects it, then delete the cart', async ({
    page,
    request,
    checkoutPage,
  }) => {
    // 1. Send GET https://api.practicesoftwaretesting.com/products via APIRequestContext to obtain a real, current product id and its price
    const productsResponse = await request.get('https://api.practicesoftwaretesting.com/products');
    expect(productsResponse.status()).toBe(200);
    const { data: products } = await productsResponse.json();
    expect(products.length).toBeGreaterThan(0);
    const product = products[0];
    expect(product.id).toEqual(expect.any(String));
    expect(product.price).toEqual(expect.any(Number));

    // 2. Send POST https://api.practicesoftwaretesting.com/carts with an empty/init body via APIRequestContext
    const cartResponse = await request.post('https://api.practicesoftwaretesting.com/carts', {
      data: {},
    });
    expect(cartResponse.status()).toBe(201);
    const { id: cartId } = await cartResponse.json();
    expect(cartId).toMatch(/^[a-z0-9]+$/);

    // 3. Send POST https://api.practicesoftwaretesting.com/carts/{cartId} via APIRequestContext with body { product_id: <id from step 1>, quantity: 2 }
    const addItemResponse = await request.post(
      `https://api.practicesoftwaretesting.com/carts/${cartId}`,
      { data: { product_id: product.id, quantity: 2 } },
    );
    expect(addItemResponse.status()).toBe(200);

    // 4. In the browser, set sessionStorage 'cart_id' to the seeded cart id (and 'cart_quantity' to '2') via page.evaluate, then navigate to 'https://practicesoftwaretesting.com/checkout'
    await page.goto('https://practicesoftwaretesting.com/');
    await page.evaluate(
      ({ id, quantity }) => {
        sessionStorage.setItem('cart_id', id);
        sessionStorage.setItem('cart_quantity', quantity);
      },
      { id: cartId, quantity: '2' },
    );
    const cartGetResponsePromise = page.waitForResponse(
      (response) =>
        response.url() === `https://api.practicesoftwaretesting.com/carts/${cartId}` &&
        response.request().method() === 'GET',
    );
    await page.goto('https://practicesoftwaretesting.com/checkout');
    const cartGetResponse = await cartGetResponsePromise;
    expect(cartGetResponse.status()).toBe(200);

    const productRow = checkoutPage.getProductRow(product.name);
    await expect(productRow).toBeVisible();
    await expect(checkoutPage.getQuantityInput(product.name)).toHaveValue('2');
    const expectedTotal = (product.price * 2).toFixed(2);
    await expect(productRow).toContainText(`$${expectedTotal}`);

    // 5. Clean up: send DELETE https://api.practicesoftwaretesting.com/carts/{cartId} via APIRequestContext
    const deleteResponse = await request.delete(`https://api.practicesoftwaretesting.com/carts/${cartId}`);
    expect(deleteResponse.status()).toBeLessThan(300);
    const getAfterDeleteResponse = await request.get(`https://api.practicesoftwaretesting.com/carts/${cartId}`);
    expect(getAfterDeleteResponse.status()).toBe(404);
  });
});
