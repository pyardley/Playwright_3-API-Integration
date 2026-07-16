// spec: specs/api-integration-session-storage.plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '@fixtures/fixtures';

test.describe('Playwright APIRequestContext for CRUD', () => {
  test('Submit the contact form and verify the underlying /messages API call and response shape', async ({
    page,
  }) => {
    // 1. Navigate to 'https://practicesoftwaretesting.com/contact'
    await page.goto('https://practicesoftwaretesting.com/contact');
    await expect(page.getByRole('heading', { name: 'Contact' })).toBeVisible();

    // 2. Fill 'First name', 'Last name', 'Email address' textboxes, select 'Customer service' from the 'Subject' dropdown, and fill the 'Message *' textbox with a message of at least 20 characters
    const firstName = 'Casey';
    const lastName = 'Contactor';
    const email = 'casey.contactor@example.com';
    const message = 'This is a test message with more than twenty characters for QA purposes.';

    const firstNameField = page.getByRole('textbox', { name: 'First name' });
    const lastNameField = page.getByRole('textbox', { name: 'Last name' });
    const emailField = page.getByRole('textbox', { name: 'Email address' });
    const subjectField = page.getByRole('combobox', { name: 'Subject' });
    const messageField = page.getByRole('textbox', { name: 'Message *' });

    await firstNameField.fill(firstName);
    await lastNameField.fill(lastName);
    await emailField.fill(email);
    await subjectField.selectOption('Customer service');
    await messageField.fill(message);

    await expect(firstNameField).toHaveValue(firstName);
    await expect(lastNameField).toHaveValue(lastName);
    await expect(emailField).toHaveValue(email);
    // The Subject dropdown's underlying option value is the slugified 'customer-service',
    // distinct from its visible 'Customer service' label.
    await expect(subjectField).toHaveValue('customer-service');
    await expect(messageField).toHaveValue(message);

    // 3. Click the 'Send' button
    const messagesResponsePromise = page.waitForResponse(
      (response) =>
        response.url() === 'https://api.practicesoftwaretesting.com/messages' &&
        response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Send' }).click();
    const messagesResponse = await messagesResponsePromise;
    expect(messagesResponse.status()).toBe(200);
    const messageBody = await messagesResponse.json();
    expect(messageBody.id).toEqual(expect.any(String));
    expect(messageBody.name).toBe(`${firstName} ${lastName}`);
    expect(messageBody.email).toBe(email);
    expect(messageBody.message).toBe(message);
    // Note: the API stores the Subject dropdown's selection as its underlying slug value
    // ('customer-service'), not the visible label text ('Customer service').
    expect(messageBody.subject).toBe('customer-service');

    await expect(page.getByRole('alert')).toHaveText(
      'Thanks for your message! We will contact you shortly.',
    );
  });
});
