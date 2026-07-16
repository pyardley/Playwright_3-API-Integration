// spec: specs/api-integration-session-storage.plan.md
// seed: tests/seed.spec.ts
// test case: 3.3. Complete a guest checkout end-to-end and verify the invoice API response shape

import { test, expect } from '@fixtures/fixtures';
import { findInStockProduct } from '@support/steps';

test.describe('Playwright APIRequestContext for CRUD', () => {
  test('Complete a guest checkout end-to-end and verify the invoice API response shape', async ({
    page,
    request,
  }) => {
    // 1. Using the UI, navigate to the home page, click the first product card, then click the 'Add to cart' button on its product detail page
    // Note: confirmed live that stock levels rotate over time and even an entire page of results
    // can be "Out of stock" (in which case 'Add to cart' stays permanently disabled), so an
    // in-stock product is located via the API's own `in_stock` field, searching across pages
    // rather than assuming page 1 has one.
    const inStockProduct = await findInStockProduct(request);
    await page.goto(`https://practicesoftwaretesting.com/product/${inStockProduct.id}`);

    const productName = (await page.locator('[data-test="product-name"]').innerText()).trim();
    await expect(page.getByRole('heading', { name: productName, level: 1 })).toBeVisible();
    const productPrice = parseFloat(await page.locator('[data-test="unit-price"]').innerText());

    const createCartResponsePromise = page.waitForResponse(
      (response) =>
        response.url() === 'https://api.practicesoftwaretesting.com/carts' &&
        response.request().method() === 'POST',
    );
    const addItemResponsePromise = page.waitForResponse(
      (response) =>
        /\/carts\/[a-z0-9]+$/.test(response.url()) &&
        response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Add to cart' }).click();
    const createCartResponse = await createCartResponsePromise;
    expect(createCartResponse.status()).toBe(201);
    const addItemResponse = await addItemResponsePromise;
    expect(addItemResponse.status()).toBe(200);
    await expect(page.locator('[data-test="cart-quantity"]')).toHaveText('1');

    // 2. Click the 'cart' link in the header to open '/checkout', then click 'Proceed to checkout' on the Cart step
    await page.getByRole('link', { name: 'cart' }).click();
    await expect(page).toHaveURL('https://practicesoftwaretesting.com/checkout');
    await page.getByRole('button', { name: 'Proceed to checkout' }).click();
    await expect(page.getByRole('tab', { name: 'Sign in' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Continue as Guest' })).toBeVisible();

    // 3. Click the 'Continue as Guest' tab, fill 'Email address *', 'First name *', 'Last name *' with valid values, then click the 'Continue as Guest' button
    await page.getByRole('tab', { name: 'Continue as Guest' }).click();
    const guestEmail = `guest.qa.${Date.now()}@example.com`;
    const guestFirstName = 'Guest';
    const guestLastName = 'Tester';
    await page.getByRole('textbox', { name: 'Email address *' }).fill(guestEmail);
    await page.getByRole('textbox', { name: 'First name *' }).fill(guestFirstName);
    await page.getByRole('textbox', { name: 'Last name *' }).fill(guestLastName);
    await page.getByRole('button', { name: 'Continue as Guest' }).click();
    await expect(
      page.getByText(`Continuing as guest: ${guestFirstName} ${guestLastName} (${guestEmail})`),
    ).toBeVisible();
    const proceedToBillingButton = page.getByRole('button', { name: 'Proceed to checkout' });
    await expect(proceedToBillingButton).toBeVisible();

    // 4. Click 'Proceed to checkout', then on the Billing Address step select a Country (e.g. 'Austria'), fill 'Postal code' and 'House number' only, and wait for the auto-filled Street/City/State values from GET https://api.practicesoftwaretesting.com/postcode-lookup
    await proceedToBillingButton.click();
    await page.getByRole('combobox', { name: 'Country' }).selectOption('Austria');
    const postcodeLookupResponsePromise = page.waitForResponse(
      (response) =>
        response.url().startsWith('https://api.practicesoftwaretesting.com/postcode-lookup') &&
        response.request().method() === 'GET',
    );
    await page.getByRole('textbox', { name: 'Postal code' }).fill('1010');
    await page.getByRole('textbox', { name: 'House number' }).fill('42');
    const postcodeLookupResponse = await postcodeLookupResponsePromise;
    expect(postcodeLookupResponse.status()).toBe(200);
    const lookup = await postcodeLookupResponse.json();
    expect(lookup.street).not.toBe('');
    expect(lookup.city).not.toBe('');
    expect(lookup.state).not.toBe('');

    const streetField = page.getByRole('textbox', { name: 'Street' });
    const cityField = page.getByRole('textbox', { name: 'City' });
    const stateField = page.getByRole('textbox', { name: 'State' });
    await expect(streetField).toHaveValue(lookup.street);
    await expect(cityField).toHaveValue(lookup.city);
    await expect(stateField).toHaveValue(lookup.state);
    const proceedToPaymentButton = page.getByRole('button', { name: 'Proceed to checkout' });
    await expect(proceedToPaymentButton).toBeEnabled();

    // 5. Click 'Proceed to checkout', select 'Cash on Delivery' from the 'Payment Method' dropdown, and click 'Confirm'
    await proceedToPaymentButton.click();
    await page.getByRole('combobox', { name: 'Payment Method' }).selectOption('Cash on Delivery');
    const paymentCheckResponsePromise = page.waitForResponse(
      (response) =>
        response.url() === 'https://api.practicesoftwaretesting.com/payment/check' &&
        response.request().method() === 'POST',
    );
    const confirmButton = page.getByRole('button', { name: 'Confirm' });
    await confirmButton.click();
    const paymentCheckResponse = await paymentCheckResponsePromise;
    expect(paymentCheckResponse.status()).toBe(200);
    await expect(page.getByText('Payment was successful')).toBeVisible();

    // 6. Click 'Confirm' a second time to finalize the order
    const invoiceResponsePromise = page.waitForResponse(
      (response) =>
        response.url() === 'https://api.practicesoftwaretesting.com/invoices/guest' &&
        response.request().method() === 'POST',
    );
    await confirmButton.click();
    const invoiceResponse = await invoiceResponsePromise;
    // Note: the live API returns 201 Created (not the 200 the plan's literal wording also allows for);
    // this assertion accepts either since both indicate the invoice was accepted, not rejected with 422.
    expect([200, 201]).toContain(invoiceResponse.status());
    const invoice = await invoiceResponse.json();
    expect(invoice.id).toEqual(expect.any(String));
    expect(invoice.total).toBeCloseTo(productPrice, 2);
    expect(invoice.subtotal).toBeCloseTo(productPrice, 2);
    expect(invoice.billing_street).toBe(lookup.street);
    expect(invoice.billing_city).toBe(lookup.city);
    expect(invoice.billing_state).toBe(lookup.state);
    expect(invoice.billing_postal_code).toBe('1010');

    // 7. Using APIRequestContext with the invoice id from step 6, send GET https://api.practicesoftwaretesting.com/invoices/{id}
    // Note: confirmed live that GET /invoices/{id} requires authentication (401 Unauthorized when
    // anonymous) and returns 404 for a different authenticated (non-admin) user, so a guest's own
    // invoice cannot be re-fetched via APIRequestContext the way an authenticated user's invoice can.
    // The invoice API response shape and billing-address consistency are therefore verified directly
    // from the POST /invoices/guest response captured above instead of a follow-up GET call. The
    // invoice response also has no cart_id field to compare against the cart created in step 1, so
    // that part of the plan's expectation does not apply to this endpoint's actual shape.
  });
});
