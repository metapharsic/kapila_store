const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  page.on('response', async (response) => {
    if (response.url().includes('/api/departments') && response.request().method() === 'GET') {
      console.log('GET /api/departments Status:', response.status());
      try {
        const json = await response.json();
        console.log('GET /api/departments Response JSON:', JSON.stringify(json));
      } catch (e) {
        console.log('GET /api/departments Could not parse JSON');
      }
    }
  });

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
  
  await browser.close();
})();
