import { Page } from '@playwright/test';
import { BasePage } from './BasePage';
import { HeaderNav } from '@components/HeaderNav';

export class ProductPage extends BasePage {
  readonly path = /\/product\//;
  readonly header: HeaderNav;

  constructor(page: Page) {
    super(page);
    this.header = new HeaderNav(page);
  }

  // Product ids are dynamic (regenerated per session/seed reset), so this is navigated to
  // directly by id rather than via the inherited goto(), which only supports static paths.
  async gotoId(id: string) {
    await this.page.goto(`https://practicesoftwaretesting.com/product/${id}`);
  }

  getNameText() {
    return this.page.locator('[data-test="product-name"]');
  }

  getUnitPriceText() {
    return this.page.locator('[data-test="unit-price"]');
  }

  getHeading(name: string) {
    return this.page.getByRole('heading', { name, level: 1 });
  }

  getAddToCartButton() {
    return this.page.getByRole('button', { name: 'Add to cart' });
  }

  async addToCart() {
    await this.getAddToCartButton().click();
  }
}
