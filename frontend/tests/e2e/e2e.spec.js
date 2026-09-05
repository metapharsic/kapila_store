import { test, expect } from '@playwright/test';

test.describe('Store Manager Flow', () => {
  test('Manager can create an indent and issue it', async ({ page }) => {
    // 1. Login
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.fill('input[autocomplete="email"]', 'store@kapila.com');
    await page.fill('input[type="password"]', 'ChangeMe123!');
    await page.click('button[type="submit"]');

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000); // Wait for animations

    // 2. Navigate to Indent Request
    await page.click('button:has-text("Indent Request")');
    await page.waitForTimeout(1000);

    // Check departments are present
    const dropdown = page.locator('select.indent-field').first();
    const options = await dropdown.locator('option').allTextContents();

    expect(options.some(t => t.includes('STAFF'))).toBeTruthy();
    expect(options.some(t => t.includes('TIFFINS'))).toBeTruthy();

    // Select STAFF
    await dropdown.selectOption({ label: 'STAFF (STF)' });

    // Fill the first row
    await page.fill('input.item-combobox-input', 'Atta');
    await page.click('text=Atta');
    await page.fill('input[type="number"]', '10');

    // Submit
    await page.click('button:has-text("Submit Indent")');
    await page.waitForSelector('text=Indent submitted', { timeout: 5000 });

    // 3. Auto-redirects to Store Issuance after submit
    await page.waitForTimeout(1500);

    // 4. Issue the indent
    // Select the pending indent from the dropdown
    const selectIndent = page.locator('select:has-text("Choose pending indent")');
    const optionValue = await page.locator('select:has-text("Choose pending indent") option:has-text("STAFF")').first().getAttribute('value');
    await selectIndent.selectOption(optionValue);

    // Verify the item is in the issue form
    await expect(page.locator('main table').first().locator('tr:has-text("Atta")')).toBeVisible();

    // Confirm the item by clicking the checkbox
    await page.click('button[aria-label="Confirm item"]');

    // Issue the material
    await page.click('button:has-text("Issue & Update Stock")');
    await page.waitForSelector('text=Material issued and stock updated ✓', { timeout: 5000 });
  });

  test('Chef can schedule production and log EOD outcome/waste', async ({ page }) => {
    // 1. Login
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.fill('input[autocomplete="email"]', 'Chef@kapila.com');
    await page.fill('input[type="password"]', 'ChangeMe123!');
    await page.click('button[type="submit"]');

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // 2. Navigate to Production Planner
    await page.click('button:has-text("Production Planner")');
    await page.waitForTimeout(1000);

    // 3. Verify tabs exist
    await expect(page.locator('main button:has-text("Recipe Library")')).toBeVisible();
    await expect(page.locator('main button:has-text("Menu & Production Schedule")')).toBeVisible();
    await expect(page.locator('main button:has-text("Log EOD Outcome / Waste")')).toBeVisible();
    await expect(page.locator('main button:has-text("Waste Analytics")')).toBeVisible();

    // 4. Click Menu & Production Schedule tab
    await page.click('main button:has-text("Menu & Production Schedule")');
    await page.waitForTimeout(500);

    // 5. Select the seeded test recipe from the dropdown
    const recipeSelect = page.locator('label:has-text("Choose a Recipe to Schedule") + select');
    await expect(recipeSelect).toBeVisible();
    await recipeSelect.selectOption({ label: 'STF Plain Rice (STAFF)' });

    // 6. Wait for the scheduling form to render
    await expect(page.locator('button:has-text("Confirm Production Plan")')).toBeVisible();

    // Select plate count and set today's date
    await page.click('button.plates-btn:has-text("150")');

    const todayStr = new Date().toISOString().slice(0, 10);
    const dateInput = page.locator('label:has-text("Planned Production Date") + input');
    await dateInput.fill(todayStr);

    // 7. Confirm Production Plan
    await page.click('button:has-text("Confirm Production Plan")');
    await page.waitForSelector('text=Production plan confirmed ✓', { timeout: 5000 });

    // 8. Go to Log Outcome
    await page.click('main button:has-text("Log Outcome")');
    await page.waitForTimeout(500);

    // 9. Verify we are on Log EOD Outcome / Waste tab
    const activeTab = page.locator('button:has-text("Recipe Library") ~ button:has-text("Log EOD Outcome / Waste")');
    await expect(activeTab).toHaveCSS('border-bottom-color', 'rgb(71, 85, 105)'); // matches slate-600 brand color

    // 10. Click Log EOD Outcome / Waste button for the plan in the list
    await page.locator('div[style*="max-height"] button:has-text("Log EOD Outcome / Waste")').first().click();

    // 11. Fill in actual sold plates
    const soldInput = page.locator('label:has-text("Plates Actually Sold") + input');
    await soldInput.fill('130');

    // Check that remaining/wasted plates auto-calculated to 20
    const wastedInput = page.locator('label:has-text("Plates Remaining / Unsold (Wasted)") + input');
    const wastedVal = await wastedInput.inputValue();
    expect(wastedVal).toBe('20');

    // 12. Submit EOD Report
    await page.click('button:has-text("Submit EOD Report")');
    await page.waitForSelector('text=End-of-day report submitted successfully ✓', { timeout: 5000 });

    // 13. Verify completed outcomes displayed
    await expect(page.locator('text=Sold: 130 plates').first()).toBeVisible();
    await expect(page.locator('text=Wasted: 20 plates').first()).toBeVisible();
  });
});
