import { Page } from '@playwright/test';
import { BasePage } from './BasePage';
import { HeaderNav } from '@components/HeaderNav';

export class LoginPage extends BasePage {
  readonly path = '/auth/login';
  readonly header: HeaderNav;

  constructor(page: Page) {
    super(page);
    this.header = new HeaderNav(page);
  }

  getHeading() {
    return this.page.getByRole('heading', { name: 'Login' });
  }

  getEmailField() {
    return this.page.getByRole('textbox', { name: 'Email address *' });
  }

  getPasswordField() {
    return this.page.getByRole('textbox', { name: 'Password *' });
  }

  getLoginButton() {
    return this.page.getByRole('button', { name: 'Login' });
  }

  async login(email: string, password: string) {
    await this.getEmailField().fill(email);
    await this.getPasswordField().fill(password);
    await this.getLoginButton().click();
  }
}
