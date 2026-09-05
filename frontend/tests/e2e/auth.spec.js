import { test, expect } from '@playwright/test';

test.describe('Auth', () => {
  test('valid login reaches dashboard', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.fill('input[autocomplete="email"]', 'store@kapila.com');
    await page.fill('input[type="password"]', 'ChangeMe123!');
    await page.click('button[type="submit"]');

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000); // wait for post-login animation/redirect
    await expect(page.locator('input[autocomplete="email"]')).toHaveCount(0);
  });

  test('invalid password shows error, stays on login', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.fill('input[autocomplete="email"]', 'store@kapila.com');
    await page.fill('input[type="password"]', 'WrongPassword123!');
    await page.click('button[type="submit"]');

    await page.waitForTimeout(1000);
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });
});
