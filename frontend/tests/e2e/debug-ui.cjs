const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  await page.goto('http://localhost:8008');
  await page.waitForLoadState('networkidle');
  
  // Fill login
  await page.fill('input[autocomplete="email"]', 'manager@kapila.local');
  await page.fill('input[autocomplete="current-password"]', 'ChangeMe123!');
  await page.click('button[type="submit"]');
  
  // wait for navigation
  await page.waitForLoadState('networkidle');
  // wait for 2s for react rendering
  await new Promise(r => setTimeout(r, 2000));
  
  // goto indent
  await page.goto('http://localhost:8008/indent');
  await page.waitForLoadState('networkidle');
  await new Promise(r => setTimeout(r, 2000));
  
  // wait for the select element
  const dropdown = await page.$('.indent-field');
  const options = await page.$$eval('.indent-field option', els => els.map(e => e.textContent));
  console.log('Dropdown options:', options);
  
  // get history table headers
  const historyDepts = await page.$$eval('.history-table-row td:first-child', els => els.map(e => e.textContent));
  console.log('History Departments:', historyDepts);
  
  await browser.close();
})();
