// spec: specs/api-integration-session-storage.plan.md
// seed: tests/seed.spec.ts
// test case: 3.4. Negative: guest checkout invoice submission fails with 422 when billing city/country are inconsistent

import { test, expect } from '@fixtures/fixtures';
import { findInStockProduct } from '@support/steps';

test.describe('Playwright APIRequestContext for CRUD', () => {
  test('Negative: guest checkout invoice submission fails with 422 when billing city/country are inconsistent', async ({
    page,
    request,
    productPage,
    checkoutPage,
  }) => {
    // 1. Repeat steps 1-3 of the guest checkout happy path (add a product to cart, reach the Billing Address step as a guest)
    // Note: confirmed live that stock levels rotate over time and even an entire page of results
    // can be "Out of stock" (in which case 'Add to cart' stays permanently disabled), so an
    // in-stock product is located via the API's own `in_stock` field, searching across pages
    // rather than assuming page 1 has one.
    const inStockProduct = await findInStockProduct(request);
    await productPage.gotoId(inStockProduct.id);
    await productPage.addToCart();
    await expect(productPage.header.getCartQuantityBadge()).toHaveText('1');

    await productPage.header.goToCart();
    await checkoutPage.clickProceed();
    const guestEmail = `guest.qa.${Date.now()}@example.com`;
    await checkoutPage.continueAsGuest(guestEmail, 'Guest', 'Tester');
    await checkoutPage.clickProceed();
    await expect(checkoutPage.getBillingHeading()).toBeVisible();

    // 2. Select Country 'Austria', fill Postal code and House number, then, after the auto-fill from GET /postcode-lookup populates Street/City/State, manually overwrite the 'City' field with a city name inconsistent with the returned value (e.g. type 'Vienna' when the lookup returned a different city) and overwrite 'Street' similarly
    // Note: uses a postal code/house number distinct from guest-checkout-invoice.spec.ts's happy
    // path (which submits a real order for 1010/42) - confirmed live that resubmitting the exact
    // same address tuple back-to-back can itself cause an unrelated 422, so this test picks its
    // own address to keep the two specs independent of each other and of run order.
    await checkoutPage.getCountrySelect().selectOption('Austria');
    const postcodeLookupResponsePromise = page.waitForResponse(
      (response) =>
        response.url().startsWith('https://api.practicesoftwaretesting.com/postcode-lookup') &&
        response.request().method() === 'GET',
    );
    await checkoutPage.getPostalCodeField().fill('4020');
    await checkoutPage.getHouseNumberField().fill('7');
    const postcodeLookupResponse = await postcodeLookupResponsePromise;
    expect(postcodeLookupResponse.status()).toBe(200);
    const lookup = await postcodeLookupResponse.json();
    expect(lookup.city).not.toBe('');

    await expect(checkoutPage.getCityField()).toHaveValue(lookup.city);
    // Deliberately overwrite the auto-filled City/Street with values inconsistent with the
    // selected country (Austria) to reproduce the real 422 billing-mismatch bug from the plan.
    await checkoutPage.getCityField().fill('Vienna');
    await checkoutPage.getStreetField().fill('Fake Street 1');
    await expect(checkoutPage.getProceedButton()).toBeEnabled();

    // 3. Proceed to the Payment step, select 'Cash on Delivery', click 'Confirm' twice (first to run the payment check, second to submit the invoice)
    await checkoutPage.clickProceed();
    await checkoutPage.selectPaymentMethod('Cash on Delivery');
    const paymentCheckResponsePromise = page.waitForResponse(
      (response) =>
        response.url() === 'https://api.practicesoftwaretesting.com/payment/check' &&
        response.request().method() === 'POST',
    );
    await checkoutPage.clickConfirm();
    const paymentCheckResponse = await paymentCheckResponsePromise;
    expect(paymentCheckResponse.status()).toBe(200);
    await expect(checkoutPage.getPaymentSuccessText()).toBeVisible();

    const invoiceResponsePromise = page.waitForResponse(
      (response) =>
        response.url() === 'https://api.practicesoftwaretesting.com/invoices/guest' &&
        response.request().method() === 'POST',
    );
    await checkoutPage.clickConfirm();
    const invoiceResponse = await invoiceResponsePromise;
    expect(invoiceResponse.status()).toBe(422);
    const invoiceError = await invoiceResponse.json();
    expect(invoiceError.message).toMatch(
      /billing_country does not match the entered address|city does not belong to the selected country/,
    );
    expect(invoiceError.errors.billing_country).toEqual(expect.any(Array));
    expect(invoiceError.errors.billing_country.length).toBeGreaterThan(0);

    // The UI does not show an order confirmation and remains on the Payment step.
    await expect(checkoutPage.getOrderConfirmationText()).toBeHidden();
    await expect(checkoutPage.getPaymentHeading()).toBeVisible();
  });
});
