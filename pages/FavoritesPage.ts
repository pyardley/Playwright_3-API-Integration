import { Page } from '@playwright/test';
import { BasePage } from './BasePage';
import { HeaderNav } from '@components/HeaderNav';

export class FavoritesPage extends BasePage {
  readonly path = '/account/favorites';
  readonly header: HeaderNav;

  constructor(page: Page) {
    super(page);
    this.header = new HeaderNav(page);
  }

  getHeading() {
    return this.page.getByRole('heading', { name: 'Favorites', level: 1 });
  }

  getFavoriteCards() {
    return this.page.locator('[data-test^="favorite-"]');
  }

  getFavoriteCard(id: string) {
    return this.page.locator(`[data-test="favorite-${id}"]`);
  }

  getFavoriteProductHeading(productName: string) {
    return this.page.getByRole('heading', { name: productName });
  }

  getRemoveButton(id: string) {
    return this.getFavoriteCard(id).getByRole('button');
  }
}
