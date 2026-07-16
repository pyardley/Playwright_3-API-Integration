// spec: specs/api-integration-session-storage.plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '@fixtures/fixtures';

test.describe('Playwright APIRequestContext for CRUD', () => {
  test('Register a new user via API, then verify login works through the UI with those credentials', async ({
    page,
    request,
  }) => {
    // 1. Build a unique UserRequest payload (first_name, last_name, address {street, city, state, country, postal_code}, phone, dob '1990-01-01', password meeting the site's strength rules e.g. 'Str0ng!Passw0rd', and a unique email such as `qa.test.<timestamp>@example.com`)
    const uniqueId = Date.now();
    const email = `qa.test.${uniqueId}@example.com`;
    // Note: the API rejects passwords found in a data-leak dictionary (e.g. the plan's literal
    // 'Str0ng!Passw0rd' example is rejected with 422), so the password embeds the unique
    // timestamp to guarantee it isn't a known-leaked password while still meeting the
    // uppercase/lowercase/number/symbol/min-8-length strength rules.
    const password = `Qa${uniqueId}!Zx`;
    const firstName = 'Quinn';
    const lastName = 'Alvarez';
    const userPayload = {
      first_name: firstName,
      last_name: lastName,
      address: {
        street: '123 Test Street',
        city: 'Springfield',
        state: 'Illinois',
        country: 'United States',
        postal_code: '62701',
      },
      phone: '0123456789',
      dob: '1990-01-01',
      password,
      email,
    };

    // 2. Send POST https://api.practicesoftwaretesting.com/users/register with that payload via APIRequestContext
    const registerResponse = await request.post(
      'https://api.practicesoftwaretesting.com/users/register',
      { data: userPayload },
    );
    expect(registerResponse.status()).toBe(201);

    // 3. Navigate to 'https://practicesoftwaretesting.com/auth/login' in the UI (no storageState applied for this test)
    await page.goto('https://practicesoftwaretesting.com/auth/login');
    await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible();

    // 4. Enter the newly registered email into the 'Email address *' textbox and the chosen password into the 'Password *' textbox, then click the 'Login' button
    await page.getByLabel('Email address *').fill(email);
    await page.getByLabel('Password *').fill(password);
    // A successful login triggers a hard page reload on this app (confirmed live: the JS
    // execution context is destroyed and several in-flight GET /users/me calls are aborted),
    // so the predicate only accepts the call that actually settles with a 200, rather than
    // matching a transient aborted/401 request from mid-reload.
    const meResponsePromise = page.waitForResponse(
      (response) =>
        response.url() === 'https://api.practicesoftwaretesting.com/users/me' &&
        response.request().method() === 'GET' &&
        response.ok(),
    );
    await page.getByRole('button', { name: 'Login' }).click();
    await expect(page).toHaveURL('https://practicesoftwaretesting.com/account');
    await expect(page.getByRole('menuitem', { name: `${firstName} ${lastName}` })).toBeVisible();
    const meResponse = await meResponsePromise;
    expect(meResponse.status()).toBe(200);
    const me = await meResponse.json();
    expect(me.email).toBe(email);

    // 5. Clean up: send a DELETE request for the created user (or, if no self-delete endpoint is available, record the id for manual/periodic cleanup) via APIRequestContext, using the Bearer token obtained from the login response
    // Note: confirmed live that DELETE /users/{id} returns 403 Forbidden for a self-registered,
    // non-admin user (only admins can delete users), so no self-delete endpoint is available here.
    // The unique per-run email means a leftover account cannot cause duplicate-email conflicts in
    // future runs, so cleanup is intentionally skipped rather than forced to fail.
    const accessToken = await page.evaluate(() => localStorage.getItem('auth-token'));
    const deleteResponse = await request.delete(
      `https://api.practicesoftwaretesting.com/users/${me.id}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    expect(deleteResponse.status()).toBe(403);
  });
});
