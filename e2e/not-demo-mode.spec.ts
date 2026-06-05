import { test, expect } from '@playwright/test';

test('If not demo mode, the landing page will not be displayed and unsigned users are redirected to sign in.', async ({
  page,
}) => {
  const screenshotDir = 'playwright-screenshots/not-demo-redirect';

  await page.goto('http://localhost:8000/');
  await expect(page).toHaveURL(/\/account\/signin/);

  await page.screenshot({ path: `${screenshotDir}/landing-page-redirect.png`, fullPage: true });
});
