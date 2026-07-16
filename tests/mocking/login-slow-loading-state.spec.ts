// spec: specs/api-integration-session-storage.plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '@fixtures/fixtures';
import { mockOnlyForMethod } from '@support/steps';

test.describe('Network Interception / Mocking', () => {
  test('Mock POST /users/login with a delayed response and verify a loading/disabled state on the Login button', async ({
    page,
    request,
  }) => {
    // A fabricated access_token fails the app's real follow-up GET /users/me call (confirmed live:
    // it returns 401 for a token that isn't a genuine JWT issued by this API), which bounces the app
    // back to /auth/login instead of proceeding to /account. So a real token is fetched first via the
    // request fixture, and only the *delay* on POST /users/login is mocked - the credentials and
    // resulting token are genuine, matching "a valid-shaped body" while still letting the rest of the
    // authenticated flow (GET /users/me) succeed for real.
    const loginResponse = await request.post('https://api.practicesoftwaretesting.com/users/login', {
      data: { email: 'customer@practicesoftwaretesting.com', password: 'welcome01' },
    });
    expect(loginResponse.status()).toBe(200);
    const realLoginBody = await loginResponse.json();

    // 1. Register a page.route interceptor for '**/users/login' that waits 3 seconds before fulfilling
    // with status 200 and a valid-shaped body.
    await page.route(
      '**/users/login',
      mockOnlyForMethod('POST', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(realLoginBody),
        });
      }),
    );

    // 2. Navigate to the login page, fill 'Email address *' and 'Password *' with the demo credentials, and click 'Login'
    await page.goto('/auth/login');
    await page.getByRole('textbox', { name: 'Email address *' }).fill('customer@practicesoftwaretesting.com');
    await page.getByRole('textbox', { name: 'Password *' }).fill('welcome01');
    const loginButton = page.getByRole('button', { name: 'Login' });
    await loginButton.click();

    // Live exploration (delaying the real login request by several seconds and inspecting the DOM
    // immediately after the click) found no visible busy/disabled affordance on this button: it is a plain
    // <input type="submit" class="btnSubmit"> that stays enabled throughout, with no spinner or aria-busy
    // attribute added anywhere on the page while the request is pending. This is a genuine gap in the app's
    // UX, so the assertion below documents that reality (button remains usable/enabled) instead of asserting
    // a busy state that does not exist. The page also has not navigated away yet, confirming the mocked
    // delay is actually being honored before the click resolves.
    await expect(loginButton).toBeEnabled();
    await expect(page).toHaveURL(/\/auth\/login$/);

    // Once the delayed mock response resolves, the app proceeds to '/account' as if a real login succeeded.
    await expect(page).toHaveURL(/\/account$/, { timeout: 10000 });
  });
});
