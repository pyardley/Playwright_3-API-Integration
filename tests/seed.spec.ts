import { test, expect } from '@fixtures/fixtures';

test('seed', { tag: ['@smoke'] }, async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL('/');
});
