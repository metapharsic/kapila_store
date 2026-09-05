import { test, expect } from '@playwright/test';

test.describe('Sidebar Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.fill('input[autocomplete="email"]', 'store@kapila.com');
    await page.fill('input[type="password"]', 'ChangeMe123!');
    await page.click('button[type="submit"]');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
  });

  test('should navigate to all core modules without crashing', async ({ page }) => {
    // 1. Home
    await page.click('nav button:has-text("Home")');
    await expect(page.locator('h1')).toBeVisible();

    // 2. Available Stock
    await page.click('nav button:has-text("Available Stock")');
    await expect(page.locator('main')).toContainText(/Stock/i);

    // 3. Store Issuance
    await page.click('nav button:has-text("Store Issuance")');
    await expect(page.locator('main h1')).toHaveText(/Store Issuance/i);

    // 4. Indent Request
    await page.click('nav button:has-text("Indent Request")');
    await expect(page.locator('main')).toContainText(/Indent/i);
  });
});
