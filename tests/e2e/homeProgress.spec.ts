import { test, expect } from '@playwright/test';

test('compact progress fits 320px and opens detailed records from the keyboard', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/');
  const preview = page.getByRole('button', { name: '学習の積み上げを詳しく見る', exact: true });
  await expect(preview).toBeVisible();
  await expect(preview).toContainText('0累積XP');
  await expect(preview).toContainText('今日 +0 XP');
  await expect(preview.getByRole('img', { name: '直近30日間の累積XP' })).toBeVisible();
  expect((await preview.boundingBox())!.height).toBeLessThan(130);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await preview.focus();
  await preview.press('Enter');
  await expect(page.getByRole('region', { name: '日々の積み上げ' })).toBeVisible();
  await expect(preview).toHaveCount(0);
});

test('home preview shares the XP ledger and updates after an answer and reload', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '○×学習を始める', exact: true }).click();
  await page.getByRole('button', { name: '○と答える', exact: true }).click();
  await expect(page.locator('.swipe-verdict')).toBeVisible();
  await page.getByRole('button', { name: '冒険', exact: true }).click();
  const preview = page.getByRole('button', { name: '学習の積み上げを詳しく見る', exact: true });
  await expect(preview).toContainText('1日連続');
  const total = (await preview.locator('.progress-preview-total').textContent())!;
  expect(total).toMatch(/^(2|10)累積XP$/);
  await page.reload();
  await expect(preview.locator('.progress-preview-total')).toHaveText(total);
  await preview.click();
  await expect(page.locator('.progress-total')).toHaveText(total);
});
