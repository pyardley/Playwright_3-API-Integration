import { Page } from '@playwright/test';

export abstract class BasePage {
  readonly page: Page;
  // string  → fixed route, usable by goto()
  // RegExp  → dynamic route (e.g. /items/:id), can only be matched with toHaveURL()
  abstract readonly path: string | RegExp;

  constructor(page: Page) {
    this.page = page;
  }

  async goto(options?: Parameters<Page['goto']>[1]) {
    if (typeof this.path !== 'string') {
      throw new Error(
        `Cannot goto() ${this.constructor.name}: its path (${this.path}) is dynamic - navigate to it via the UI flow instead.`,
      );
    }
    await this.page.goto(this.path, options);
  }

  async scrollToBottom() {
    await this.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  }

  async scrollToTop() {
    await this.page.evaluate(() => window.scrollTo(0, 0));
  }

  // Override getScrollToTopButton() with the app's specific selector,
  // e.g. this.page.locator('#scrollUp') or getByRole('button', {name: 'Back to top'}).
  async getScrollToTopButton() {
    return this.page.locator('#scrollUp');
  }

  async clickScrollToTopButton() {
    await (await this.getScrollToTopButton()).click();
  }
}
