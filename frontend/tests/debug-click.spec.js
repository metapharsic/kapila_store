import { test, expect } from '@playwright/test';

test('debug click item', async ({ page }) => {
  const logs = [];
  page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', error => logs.push(`[pageerror] ${error.message}\n${error.stack}`));

  await page.goto('http://localhost:5173');
  
  // Login if needed
  try {
    const userInput = await page.waitForSelector('input[type="text"]', { timeout: 2000 });
    if (userInput) {
      await page.fill('input[type="text"]', 'admin');
      await page.fill('input[type="password"]', 'admin123');
      await page.click('button:has-text("Login")');
      await page.waitForTimeout(1000);
    }
  } catch(e) {}

  // Navigate to Gate passes
  try {
    await page.click('text="Gate Passes"');
  } catch(e) {}
  
  await page.waitForTimeout(1000);
  
  console.log("=== Logs before click ===");
  console.log(logs.join('\n'));
  logs.length = 0; // clear

  // Click on pass number or item name
  // Try finding an item name in Stock or a pass number
  const spans = await page.$$('span');
  let clicked = false;
  for (const span of spans) {
    const text = await span.innerText();
    if (text.includes('Gate') || text.includes('KPL')) continue; // Skip header
    // We try to click the first likely item name
    try {
      await span.click();
      clicked = true;
      break;
    } catch(e) {}
  }
  
  // Or try button (for pass number)
  if (!clicked) {
    const buttons = await page.$$('button');
    for (const btn of buttons) {
      const text = await btn.innerText();
      if (text.startsWith('GP-') || text.startsWith('RGP-')) {
        await btn.click();
        break;
      }
    }
  }

  await page.waitForTimeout(2000);

  console.log("=== Logs after click ===");
  console.log(logs.join('\n'));
});
