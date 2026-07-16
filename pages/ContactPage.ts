import { Page } from '@playwright/test';
import { BasePage } from './BasePage';
import { HeaderNav } from '@components/HeaderNav';

export class ContactPage extends BasePage {
  readonly path = '/contact';
  readonly header: HeaderNav;

  constructor(page: Page) {
    super(page);
    this.header = new HeaderNav(page);
  }

  getHeading() {
    return this.page.getByRole('heading', { name: 'Contact' });
  }

  getFirstNameField() {
    return this.page.getByRole('textbox', { name: 'First name' });
  }

  getLastNameField() {
    return this.page.getByRole('textbox', { name: 'Last name' });
  }

  getEmailField() {
    return this.page.getByRole('textbox', { name: 'Email address' });
  }

  getSubjectSelect() {
    return this.page.getByRole('combobox', { name: 'Subject' });
  }

  getMessageField() {
    return this.page.getByRole('textbox', { name: 'Message *' });
  }

  getSendButton() {
    return this.page.getByRole('button', { name: 'Send' });
  }

  getConfirmationAlert() {
    return this.page.getByRole('alert');
  }

  async fillForm(fields: {
    firstName: string;
    lastName: string;
    email: string;
    subject: string;
    message: string;
  }) {
    await this.getFirstNameField().fill(fields.firstName);
    await this.getLastNameField().fill(fields.lastName);
    await this.getEmailField().fill(fields.email);
    await this.getSubjectSelect().selectOption(fields.subject);
    await this.getMessageField().fill(fields.message);
  }

  async submit() {
    await this.getSendButton().click();
  }
}
