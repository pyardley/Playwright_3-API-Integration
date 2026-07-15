import { test as base, expect } from '@playwright/test';

// Pattern for blocking ad domains in smoke runs (where real-site ads can
// inject markup that breaks locators). Expand AD_DOMAIN_PATTERN to match
// the ad networks the target app loads.
const AD_DOMAIN_PATTERN = /\.(doubleclick|googlesyndication|adnxs)\.com/;

type Fixtures = {
  blockAdDomains: void;
  // Add page objects here as they're created:
  // homePage: HomePage;
};

export const test = base.extend<Fixtures>({
  blockAdDomains: [
    async ({ page }, use) => {
      if (process.env.TEST_SUITE !== 'e2e') {
        await page.route(AD_DOMAIN_PATTERN, (route) => route.abort());
      }
      await use();
    },
    { auto: true },
  ],
  // homePage: async ({ page }, use) => use(new HomePage(page)),
});

export { expect };
