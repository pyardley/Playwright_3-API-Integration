import { test as base, expect } from '@playwright/test';
import { HomePage } from '@pages/HomePage';
import { LoginPage } from '@pages/LoginPage';
import { AccountPage } from '@pages/AccountPage';
import { FavoritesPage } from '@pages/FavoritesPage';
import { ProductPage } from '@pages/ProductPage';
import { CheckoutPage } from '@pages/CheckoutPage';
import { ContactPage } from '@pages/ContactPage';

// Pattern for blocking ad domains in smoke runs (where real-site ads can
// inject markup that breaks locators). Expand AD_DOMAIN_PATTERN to match
// the ad networks the target app loads.
const AD_DOMAIN_PATTERN = /\.(doubleclick|googlesyndication|adnxs)\.com/;

type Fixtures = {
  blockAdDomains: void;
  homePage: HomePage;
  loginPage: LoginPage;
  accountPage: AccountPage;
  favoritesPage: FavoritesPage;
  productPage: ProductPage;
  checkoutPage: CheckoutPage;
  contactPage: ContactPage;
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
  homePage: async ({ page }, use) => use(new HomePage(page)),
  loginPage: async ({ page }, use) => use(new LoginPage(page)),
  accountPage: async ({ page }, use) => use(new AccountPage(page)),
  favoritesPage: async ({ page }, use) => use(new FavoritesPage(page)),
  productPage: async ({ page }, use) => use(new ProductPage(page)),
  checkoutPage: async ({ page }, use) => use(new CheckoutPage(page)),
  contactPage: async ({ page }, use) => use(new ContactPage(page)),
});

export { expect };
