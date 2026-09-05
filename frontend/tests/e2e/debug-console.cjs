const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  await page.goto('http://localhost:8008');
  await page.waitForLoadState('networkidle');
  
  // Fill login
  await page.fill('input[autocomplete="email"]', 'manager@kapila.local');
  await page.fill('input[autocomplete="current-password"]', 'ChangeMe123!');
  await page.click('button[type="submit"]');
  
  await page.waitForLoadState('networkidle');
  await new Promise(r => setTimeout(r, 2000));
  
  await page.goto('http://localhost:8008/indent');
  await page.waitForLoadState('networkidle');
  await new Promise(r => setTimeout(r, 2000));
  
  const dropdown = await page.$('.indent-field');
  const options = await page.$$eval('.indent-field option', els => els.map(e => e.textContent));
  console.log('Dropdown options:', options);

  await browser.close();
})();
