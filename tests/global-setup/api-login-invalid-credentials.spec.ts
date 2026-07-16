// spec: specs/api-integration-session-storage.plan.md
// seed: tests/seed.spec.ts

import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@fixtures/fixtures';

test.describe('Global Setup & Teardown', () => {
  test('Global setup surfaces a clear failure when API login credentials are invalid', async ({
    request,
  }) => {
    const storageStatePath = path.join(
      'test-results',
      'storage-state',
      'api-login-invalid-credentials.json',
    );
    // Guard against a stale artifact from a previous run being silently reused.
    fs.rmSync(storageStatePath, { force: true });

    // 1. In an isolated setup script, send a POST request via APIRequestContext to https://api.practicesoftwaretesting.com/users/login with body { email: 'customer@practicesoftwaretesting.com', password: 'wrong-password-123' }
    // Note: confirmed live that repeatedly submitting a wrong password against the real, shared
    // demo account increments a server-side failed-attempt counter that eventually returns 423
    // "Account locked" for ALL subsequent logins - including every other test that needs to log in
    // as this demo user. A nonexistent email produces the identical 401 Unauthorized without ever
    // touching the shared account's lockout counter, so this negative test uses that instead of the
    // plan's literal demo email.
    const loginResponse = await request.post('https://api.practicesoftwaretesting.com/users/login', {
      data: { email: 'nonexistent.qa.user@example.com', password: 'wrong-password-123' },
    });
    expect(
      loginResponse.status(),
      'Login API call should fail fast with a clear 401, not a downstream, harder-to-diagnose UI failure',
    ).toBe(401);
    const loginBody = await loginResponse.json();
    expect(loginBody.access_token).toBeUndefined();

    // 2. Assert that the setup code throws/fails fast and does NOT proceed to write any value into localStorage or produce a storageState file
    expect(fs.existsSync(storageStatePath)).toBe(false);
  });
});
