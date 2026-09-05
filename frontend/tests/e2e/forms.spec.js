import { test, expect } from '@playwright/test';

test.describe('Form Verification', () => {
  test('should submit New Stock entry form and update table', async ({ page }) => {
    // 1. Login
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.fill('input[autocomplete="email"]', 'store@kapila.com');
    await page.fill('input[type="password"]', 'ChangeMe123!');
    await page.click('button[type="submit"]');

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // 2. Navigate to Stock and open Add Item drawer
    await page.click('button:has-text("Stock")');
    await page.waitForTimeout(500);
    await page.click('button:has-text("Add Item")');

    // 3. Fill form
    const itemName = `Test Tomatoes ${Date.now()}`;
    await page.fill('label:has-text("Item Name") + input', itemName);
    await page.fill('label:has-text("Opening Qty") + input', '50');
    await page.fill('label:has-text("Price per Unit") + input', '20');

    // 4. Submit (2nd match — 1st is the toolbar button that opened the drawer)
    await page.locator('button:has-text("Add Item")').nth(1).click();

    // 5. Drawer closes, new item shows in table
    await expect(page.locator('label:has-text("Item Name")')).toHaveCount(0, { timeout: 5000 });
    await expect(page.locator('table')).toContainText(itemName);
  });
});
