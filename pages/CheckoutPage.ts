import { Page } from '@playwright/test';
import { BasePage } from './BasePage';
import { HeaderNav } from '@components/HeaderNav';

export class CheckoutPage extends BasePage {
  readonly path = '/checkout';
  readonly header: HeaderNav;

  constructor(page: Page) {
    super(page);
    this.header = new HeaderNav(page);
  }

  // Cart step
  getProductRow(productName: string) {
    return this.page.getByRole('row', { name: new RegExp(productName) });
  }

  getQuantityInput(productName: string) {
    return this.getProductRow(productName).getByRole('spinbutton', {
      name: `Quantity for ${productName}`,
    });
  }

  getEmptyCartText() {
    return this.page.getByText('The cart is empty. Nothing to display.');
  }

  getContinueShoppingButton() {
    return this.page.getByRole('button', { name: 'Continue Shopping' });
  }

  getProceedButton() {
    return this.page.getByRole('button', { name: 'Proceed to checkout' });
  }

  async clickProceed() {
    await this.getProceedButton().click();
  }

  // Sign in / Guest step
  getSignInTab() {
    return this.page.getByRole('tab', { name: 'Sign in' });
  }

  getGuestTab() {
    return this.page.getByRole('tab', { name: 'Continue as Guest' });
  }

  getGuestEmailField() {
    return this.page.getByRole('textbox', { name: 'Email address *' });
  }

  getGuestFirstNameField() {
    return this.page.getByRole('textbox', { name: 'First name *' });
  }

  getGuestLastNameField() {
    return this.page.getByRole('textbox', { name: 'Last name *' });
  }

  getGuestSubmitButton() {
    return this.page.getByRole('button', { name: 'Continue as Guest' });
  }

  getGuestConfirmationText(text: string) {
    return this.page.getByText(text);
  }

  async continueAsGuest(email: string, firstName: string, lastName: string) {
    await this.getGuestTab().click();
    await this.getGuestEmailField().fill(email);
    await this.getGuestFirstNameField().fill(firstName);
    await this.getGuestLastNameField().fill(lastName);
    await this.getGuestSubmitButton().click();
  }

  // Billing Address step
  getBillingHeading() {
    return this.page.getByRole('heading', { name: 'Billing Address' });
  }

  getCountrySelect() {
    return this.page.getByRole('combobox', { name: 'Country' });
  }

  getPostalCodeField() {
    return this.page.getByRole('textbox', { name: 'Postal code' });
  }

  getHouseNumberField() {
    return this.page.getByRole('textbox', { name: 'House number' });
  }

  getStreetField() {
    return this.page.getByRole('textbox', { name: 'Street' });
  }

  getCityField() {
    return this.page.getByRole('textbox', { name: 'City' });
  }

  getStateField() {
    return this.page.getByRole('textbox', { name: 'State' });
  }

  async fillBillingAddress(country: string, postalCode: string, houseNumber: string) {
    await this.getCountrySelect().selectOption(country);
    await this.getPostalCodeField().fill(postalCode);
    await this.getHouseNumberField().fill(houseNumber);
  }

  // Payment step
  getPaymentHeading() {
    return this.page.getByRole('heading', { name: 'Payment' });
  }

  getPaymentMethodSelect() {
    return this.page.getByRole('combobox', { name: 'Payment Method' });
  }

  getConfirmButton() {
    return this.page.getByRole('button', { name: 'Confirm' });
  }

  getPaymentSuccessText() {
    return this.page.getByText('Payment was successful');
  }

  getOrderConfirmationText() {
    return this.page.getByText(/Thanks for your order/);
  }

  async selectPaymentMethod(method: string) {
    await this.getPaymentMethodSelect().selectOption(method);
  }

  async clickConfirm() {
    await this.getConfirmButton().click();
  }
}
