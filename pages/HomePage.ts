import { Page } from '@playwright/test';
import { BasePage } from './BasePage';
import { HeaderNav } from '@components/HeaderNav';

export class HomePage extends BasePage {
  readonly path = '/';
  readonly header: HeaderNav;

  constructor(page: Page) {
    super(page);
    this.header = new HeaderNav(page);
  }

  getProductCards() {
    return this.page.locator('[data-test^="product-"]');
  }

  getProductCardHeading(name: string) {
    return this.page.getByRole('heading', { name, level: 5 });
  }

  getSearchBox() {
    return this.page.getByRole('textbox', { name: 'Search' });
  }

  getSearchButton() {
    return this.page.getByRole('button', { name: 'Search' });
  }

  getSearchResultsHeading(term: string) {
    return this.page.getByRole('heading', { name: `Searched for: ${term}`, level: 3 });
  }

  getResultsCountText(text: string) {
    return this.page.getByText(text);
  }

  getEmptyStateText() {
    return this.page.getByText('There are no products found.');
  }

  getPaginationButton(label: string) {
    return this.page.getByRole('button', { name: label });
  }

  getFiltersHeading() {
    return this.page.getByRole('heading', { name: 'Filters', level: 4 });
  }

  getFooterText() {
    return this.page.getByText('This is a DEMO application');
  }

  async search(term: string) {
    await this.getSearchBox().fill(term);
    await this.getSearchButton().click();
  }
}
