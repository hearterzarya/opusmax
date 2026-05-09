import { chromium } from '@playwright/test';

async function exploreApp() {
  console.log('Launching browser...');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const context = await browser.newContext({
    // Force using 127.0.0.1 instead of localhost
  });

  const page = await context.newPage();

  // Debug - check what's happening
  page.on('request', request => {
    console.log('Request:', request.url());
  });

  page.on('response', response => {
    console.log('Response:', response.status(), response.url());
  });

  page.on('requestfailed', request => {
    console.log('Request failed:', request.url(), request.failure()?.errorText);
  });

  try {
    console.log('Navigating to 127.0.0.1:3000...');
    const response = await page.goto('http://127.0.0.1:3000', {
      timeout: 15000,
      waitUntil: 'commit'
    });
    console.log('Success! Status:', response?.status());
    console.log('URL:', page.url());
    console.log('Title:', await page.title());
  } catch (error) {
    console.log('Error:', error.message);
  }

  await browser.close();
}

exploreApp().catch(console.error);