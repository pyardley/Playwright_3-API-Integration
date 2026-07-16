import { Page } from '@playwright/test';

export class HeaderNav {
  constructor(private readonly page: Page) {}

  getMainMenu() {
    return this.page.getByRole('menubar', { name: 'Main menu' });
  }

  getAccountMenuItem(name: string) {
    return this.page.getByRole('menuitem', { name });
  }

  getSignInMenuItem() {
    return this.page.getByRole('menuitem', { name: 'Sign in' });
  }

  getCartLink() {
    return this.page.getByRole('link', { name: 'cart' });
  }

  getCartQuantityBadge() {
    return this.page.locator('[data-test="cart-quantity"]');
  }

  async goToCart() {
    await this.getCartLink().click();
  }
}
