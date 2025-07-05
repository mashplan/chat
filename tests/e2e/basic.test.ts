import { test, expect } from '@playwright/test';

test.describe('Basic functionality', () => {
  test('Health endpoint works', async ({ page }) => {
    const response = await page.goto('/api/health');
    expect(response?.status()).toBe(200);

    const text = await page.textContent('body');
    expect(text).toContain('healthy');
  });

  test('Login page loads', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByPlaceholder('user@acme.com')).toBeVisible();
  });
});
