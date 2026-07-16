// spec: specs/api-integration-session-storage.plan.md
// seed: tests/seed.spec.ts
// test case: 3.5. Negative: registering with an already-used email returns 409 Conflict

import { test, expect } from '@fixtures/fixtures';

test.describe('Playwright APIRequestContext for CRUD', () => {
  test('Negative: registering with an already-used email returns 409 Conflict', async ({
    request,
  }) => {
    const uniqueId = Date.now();
    const email = `qa.dup.${uniqueId}@example.com`;
    // Password embeds the unique timestamp so it isn't a known-leaked password (the API rejects
    // common/leaked passwords with 422 even when the strength rules are otherwise satisfied).
    const password = `Qa${uniqueId}!Zx`;
    const userPayload = {
      first_name: 'Dana',
      last_name: 'Dupe',
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

    // 1. Send POST https://api.practicesoftwaretesting.com/users/register via APIRequestContext with a fresh unique email and a valid full UserRequest payload
    const firstRegisterResponse = await request.post(
      'https://api.practicesoftwaretesting.com/users/register',
      { data: userPayload },
    );
    expect(firstRegisterResponse.status()).toBe(201);

    // 2. Immediately send a second POST https://api.practicesoftwaretesting.com/users/register with the identical email but otherwise valid payload
    const secondRegisterResponse = await request.post(
      'https://api.practicesoftwaretesting.com/users/register',
      { data: userPayload },
    );
    expect(secondRegisterResponse.status()).toBe(409);
    const secondRegisterBody = await secondRegisterResponse.json();
    // Note: the live API's 409 body is a field-level validation error shape
    // (`{ email: ["A customer with this email address already exists."] }`), not the flat
    // top-level `message` field the plan's wording implies, so the assertion targets the actual shape.
    expect(secondRegisterBody.email).toEqual(
      expect.arrayContaining([expect.stringMatching(/already exists/i)]),
    );

    // 3. Clean up any test data created in step 1 as feasible
    // Note: confirmed live (see register-then-login.spec.ts) that DELETE /users/{id} returns 403
    // Forbidden for a self-registered, non-admin user, so no self-delete endpoint is available.
    // The unique per-run email guarantees a leftover account cannot cause duplicate-email
    // conflicts in future runs, so no further cleanup is required or attempted here.
  });
});
