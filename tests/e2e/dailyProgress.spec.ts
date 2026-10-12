import { test, expect } from '@playwright/test';

const fixedNow = new Date('2026-10-13T03:00:00Z');

test('daily progress has a genuine zero state on a 320px screen', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/');
  await page.getByRole('button', { name: '記録', exact: true }).click();
  const graph = page.getByRole('region', { name: '日々の積み上げ' });
  await expect(graph.locator('.progress-total')).toHaveText('0累積XP');
  await expect(graph.locator('.progress-empty')).toBeVisible();
  await graph.getByRole('button', { name: '90日', exact: true }).click();
  await expect(graph.getByRole('img')).toHaveAttribute('aria-label', /90日間/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('restored ledger draws both modes and day details work with touch and keyboard', async ({ page }) => {
  await page.clock.install({ time: fixedNow });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    const learningEvents = Array.from({ length: 13 }, (_, i) => [
      { cardId: 'archived-1', revision: '1:○', answer: true, at: `2026-10-${String(i + 1).padStart(2, '0')}T03:00:00Z`, mode: 'swipe', xp: 10, bonusXp: 0 },
      { cardId: 'archived-2', revision: '1:○', answer: true, at: `2026-10-${String(i + 1).padStart(2, '0')}T03:00:00Z`, mode: 'five-choice', xp: 10, bonusXp: 20 },
    ]).flat();
    localStorage.setItem('care-manager-quest:learning:v3', JSON.stringify({ schemaVersion: 3, learningEvents, attempts: [], concepts: {}, externalRecords: [], settings: { sound: false } }));
  });
  await page.goto('/');
  await page.getByRole('button', { name: '記録', exact: true }).click();
  const graph = page.getByRole('region', { name: '日々の積み上げ' });
  await expect(graph.locator('.progress-total')).toHaveText('520累積XP');
  await expect(graph.locator('.progress-streak')).toHaveText('13日連続');
  await expect(graph.locator('.progress-day-detail')).toHaveText('10/13 今日+40 XP2回答');
  await graph.getByRole('button', { name: '7日', exact: true }).click();
  await expect(graph.locator('.progress-meta')).toContainText('+280 XP');
  await expect(graph.locator('.progress-total')).toContainText('520');
  const slider = graph.getByRole('slider', { name: '日付を選ぶ' });
  await slider.focus();
  await slider.press('ArrowLeft');
  await expect(graph.locator('.progress-day-detail')).toContainText('10/12');
  await expect(slider).toHaveAttribute('aria-valuetext', '10/12、40 XP、2回答');
  const bounds = (await graph.getByRole('img').boundingBox())!;
  await page.touchscreen.tap(bounds.x + bounds.width * .034, bounds.y + bounds.height * .4);
  await expect(graph.locator('.progress-day-detail')).toContainText('10/7');
  await graph.getByRole('button', { name: '30日', exact: true }).click();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(graph.locator('.progress-line')).toHaveCSS('animation-name', 'none');
  await page.setViewportSize({ width: 320, height: 720 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('a new swipe answer immediately increases daily progress and survives a reload', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '○×学習を始める', exact: true }).click();
  await page.getByRole('button', { name: '○と答える', exact: true }).click();
  await expect(page.locator('.swipe-verdict')).toBeVisible();
  await page.getByRole('button', { name: '記録', exact: true }).click();
  const graph = page.getByRole('region', { name: '日々の積み上げ' });
  const earned = (await graph.locator('.progress-total').textContent())!;
  expect(earned).toMatch(/(2|10)\s*累積XP/);
  await expect(graph.locator('.progress-streak')).toHaveText('1日連続');
  await expect(graph.locator('.progress-day-detail')).toContainText('1回答');
  await page.reload();
  await page.getByRole('button', { name: '記録', exact: true }).click();
  await expect(graph.locator('.progress-total')).toHaveText(earned);
});
