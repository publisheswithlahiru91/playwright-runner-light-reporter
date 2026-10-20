import { test, expect } from '@playwright/test';

test.describe('Checkout flow @smoke', () => {
  test('REQ_PROJ-101 TEST_TC-9001 completes happy path @functional', async ({ page }) => {
    await test.step('Open store', async () => {
      await page.setContent('<html><body><h1>Example Domain</h1></body></html>');
    });
    await test.step('Verify landing page', async () => {
      await expect(page.getByRole('heading', { name: 'Example Domain' })).toBeVisible();
    });
  });

  test('REQ_PROJ-102 TEST_TC-9002 shows failure details @regression', async ({ page }) => {
    await test.step('Navigate', async () => {
      await page.setContent('<html><body><h1>Example Domain</h1></body></html>');
    });
    await test.step('Assert missing heading', async () => {
      await expect(page.getByRole('heading', { name: 'Not Found' })).toBeVisible({ timeout: 2000 });
    });
  });
});
