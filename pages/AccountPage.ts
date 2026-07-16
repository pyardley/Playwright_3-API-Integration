import { Page } from '@playwright/test';
import { BasePage } from './BasePage';
import { HeaderNav } from '@components/HeaderNav';

export class AccountPage extends BasePage {
  readonly path = '/account';
  readonly header: HeaderNav;

  constructor(page: Page) {
    super(page);
    this.header = new HeaderNav(page);
  }

  getHeading() {
    return this.page.getByRole('heading', { name: 'My account' });
  }

  getFavoritesButton() {
    return this.page.getByRole('button', { name: 'Favorites' });
  }

  getProfileButton() {
    return this.page.getByRole('button', { name: 'Profile' });
  }

  getInvoicesButton() {
    return this.page.getByRole('button', { name: 'Invoices' });
  }

  getMessagesButton() {
    return this.page.getByRole('button', { name: 'Messages' });
  }
}
