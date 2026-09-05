const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));

  await page.goto('http://localhost:8008');
  await page.waitForLoadState('networkidle');
  
  // Fill login
  await page.fill('input[autocomplete="email"]', 'manager@kapila.local');
  await page.fill('input[autocomplete="current-password"]', 'ChangeMe123!');
  await page.click('button[type="submit"]');
  
  await page.waitForLoadState('networkidle');
  await new Promise(r => setTimeout(r, 2000));
  
  // Click the Indent Material button in sidebar
  await page.click('button:has-text("Indent Material")');
  
  await new Promise(r => setTimeout(r, 3000));
  
  const options = await page.$$eval('.indent-field option', els => els.map(e => e.textContent));
  console.log('Dropdown options:', options);
  
  const historyDepts = await page.$$eval('.history-table-row td:first-child', els => els.map(e => e.textContent));
  console.log('History Departments:', historyDepts);

  await browser.close();
})();
