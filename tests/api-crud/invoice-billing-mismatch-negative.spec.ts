// spec: specs/api-integration-session-storage.plan.md
// seed: tests/seed.spec.ts
// test case: 3.4. Negative: guest checkout invoice submission fails with 422 when billing city/country are inconsistent

import { test, expect } from '@fixtures/fixtures';
import { findInStockProduct } from '@support/steps';

test.describe('Playwright APIRequestContext for CRUD', () => {
  test('Negative: guest checkout invoice submission fails with 422 when billing city/country are inconsistent', async ({
    page,
    request,
  }) => {
    // 1. Repeat steps 1-3 of the guest checkout happy path (add a product to cart, reach the Billing Address step as a guest)
    // Note: confirmed live that stock levels rotate over time and even an entire page of results
    // can be "Out of stock" (in which case 'Add to cart' stays permanently disabled), so an
    // in-stock product is located via the API's own `in_stock` field, searching across pages
    // rather than assuming page 1 has one.
    const inStockProduct = await findInStockProduct(request);
    await page.goto(`https://practicesoftwaretesting.com/product/${inStockProduct.id}`);
    await page.getByRole('button', { name: 'Add to cart' }).click();
    await expect(page.locator('[data-test="cart-quantity"]')).toHaveText('1');

    await page.getByRole('link', { name: 'cart' }).click();
    await page.getByRole('button', { name: 'Proceed to checkout' }).click();
    await page.getByRole('tab', { name: 'Continue as Guest' }).click();
    const guestEmail = `guest.qa.${Date.now()}@example.com`;
    await page.getByRole('textbox', { name: 'Email address *' }).fill(guestEmail);
    await page.getByRole('textbox', { name: 'First name *' }).fill('Guest');
    await page.getByRole('textbox', { name: 'Last name *' }).fill('Tester');
    await page.getByRole('button', { name: 'Continue as Guest' }).click();
    await page.getByRole('button', { name: 'Proceed to checkout' }).click();
    await expect(page.getByRole('heading', { name: 'Billing Address' })).toBeVisible();

    // 2. Select Country 'Austria', fill Postal code and House number, then, after the auto-fill from GET /postcode-lookup populates Street/City/State, manually overwrite the 'City' field with a city name inconsistent with the returned value (e.g. type 'Vienna' when the lookup returned a different city) and overwrite 'Street' similarly
    // Note: uses a postal code/house number distinct from guest-checkout-invoice.spec.ts's happy
    // path (which submits a real order for 1010/42) - confirmed live that resubmitting the exact
    // same address tuple back-to-back can itself cause an unrelated 422, so this test picks its
    // own address to keep the two specs independent of each other and of run order.
    await page.getByRole('combobox', { name: 'Country' }).selectOption('Austria');
    const postcodeLookupResponsePromise = page.waitForResponse(
      (response) =>
        response.url().startsWith('https://api.practicesoftwaretesting.com/postcode-lookup') &&
        response.request().method() === 'GET',
    );
    await page.getByRole('textbox', { name: 'Postal code' }).fill('4020');
    await page.getByRole('textbox', { name: 'House number' }).fill('7');
    const postcodeLookupResponse = await postcodeLookupResponsePromise;
    expect(postcodeLookupResponse.status()).toBe(200);
    const lookup = await postcodeLookupResponse.json();
    expect(lookup.city).not.toBe('');

    const cityField = page.getByRole('textbox', { name: 'City' });
    const streetField = page.getByRole('textbox', { name: 'Street' });
    await expect(cityField).toHaveValue(lookup.city);
    // Deliberately overwrite the auto-filled City/Street with values inconsistent with the
    // selected country (Austria) to reproduce the real 422 billing-mismatch bug from the plan.
    await cityField.fill('Vienna');
    await streetField.fill('Fake Street 1');
    const proceedToPaymentButton = page.getByRole('button', { name: 'Proceed to checkout' });
    await expect(proceedToPaymentButton).toBeEnabled();

    // 3. Proceed to the Payment step, select 'Cash on Delivery', click 'Confirm' twice (first to run the payment check, second to submit the invoice)
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

    const invoiceResponsePromise = page.waitForResponse(
      (response) =>
        response.url() === 'https://api.practicesoftwaretesting.com/invoices/guest' &&
        response.request().method() === 'POST',
    );
    await confirmButton.click();
    const invoiceResponse = await invoiceResponsePromise;
    expect(invoiceResponse.status()).toBe(422);
    const invoiceError = await invoiceResponse.json();
    expect(invoiceError.message).toMatch(
      /billing_country does not match the entered address|city does not belong to the selected country/,
    );
    expect(invoiceError.errors.billing_country).toEqual(expect.any(Array));
    expect(invoiceError.errors.billing_country.length).toBeGreaterThan(0);

    // The UI does not show an order confirmation and remains on the Payment step.
    await expect(page.getByText(/Thanks for your order/)).toBeHidden();
    await expect(page.getByRole('heading', { name: 'Payment' })).toBeVisible();
  });
});
