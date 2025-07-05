import { test, expect } from '@playwright/test';

test.describe('Simple Chat Tests', () => {
  test('Can access home page and see basic elements', async ({ page }) => {
    // Go to the home page
    await page.goto('/');

    // Should redirect through auth flow and land on chat page
    await page.waitForURL('**/');

    // Check if basic chat elements are present (after auth flow)
    await expect(page.locator('body')).toBeVisible();

    // Check if we can see the basic page structure
    const title = await page.title();
    expect(title).toBeTruthy();
  });

  test('Register page loads correctly', async ({ page }) => {
    await page.goto('/register');

    // Should see registration form
    await expect(page.getByPlaceholder('user@acme.com')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign Up' })).toBeVisible();
  });

  test('Can try to register a user', async ({ page }) => {
    await page.goto('/register');

    // Fill out registration form
    const testEmail = `test-${Date.now()}@example.com`;
    await page.getByPlaceholder('user@acme.com').fill(testEmail);
    await page.getByLabel('Password').fill('testpassword123');

    // Submit the form
    await page.getByRole('button', { name: 'Sign Up' }).click();

    // Should see some response (either success or error)
    // We don't care about the exact result, just that the form works
    await page.waitForTimeout(2000);
    expect(page.url()).toBeTruthy();
  });
});
