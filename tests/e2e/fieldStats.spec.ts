import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

test('field stats show unanswered fields and can navigate all category levels on a narrow screen', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/');
  await page.getByRole('button', { name: '記録', exact: true }).click();
  const stats = page.getByRole('region', { name: '分野別の得意・苦手' });
  await expect(stats.locator('.field-row')).toHaveCount(5);
  await expect(stats.locator('.field-overview')).toContainText('未学習');
  await expect(stats.locator('.field-overview .field-metrics')).toContainText('—');
  await stats.getByRole('button', { name: '介護保険制度の内訳を見る', exact: true }).click();
  await expect(stats.getByRole('button', { name: '介護保険制度', exact: true })).toHaveAttribute('aria-current', 'page');
  await stats.getByRole('button', { name: '保険料・財政の内訳を見る', exact: true }).click();
  await stats.getByRole('button', { name: '第1号被保険者保険料の内訳を見る', exact: true }).click();
  expect(await stats.locator('.field-row').count()).toBeGreaterThan(0);
  await expect(stats.locator('.field-row .field-heading button')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await stats.getByRole('button', { name: '全分野', exact: true }).click();
  await stats.getByLabel('並び順').selectOption('weak');
  await expect(stats.locator('.field-row')).toHaveCount(5);
});

test('correct and same-day retry are one measured answer, visible through ancestors and after reload', async ({ page }) => {
  const truth = JSON.parse(readFileSync(new URL('../../data/choice-tf/choice-answers-2005-2025.json', import.meta.url), 'utf8')).questions;
  await page.goto('/');
  await page.getByRole('button', { name: '○×学習を始める', exact: true }).click();
  const meta = (await page.locator('.swipe-screen .question-meta').textContent())!.match(/(\d{4})年度 問(\d+)・選択肢(\d)/)!;
  const correct = truth[`${meta[1]}-${meta[2].padStart(2, '0')}`].choiceAnswers[Number(meta[3]) - 1] === '○';
  await page.getByRole('button', { name: correct ? '○と答える' : '×と答える', exact: true }).click();
  await expect(page.locator('.swipe-verdict')).toBeVisible();
  // Repeat with the opposite answer; it is practice, not another measured answer.
  await page.getByRole('button', { name: '同じカードを再練習（XPなし）', exact: true }).click();
  await page.getByRole('button', { name: correct ? '×と答える' : '○と答える', exact: true }).click();
  await page.getByRole('button', { name: '記録', exact: true }).click();
  const stats = page.getByRole('region', { name: '分野別の得意・苦手' });
  await expect(stats.locator('.field-overview')).toContainText('判定前');
  await expect(stats.locator('.field-overview .field-counts')).toContainText('1 / 1回答 正解');
  await expect(stats.locator('.field-overview .field-metrics')).toContainText('100%');
  const studied = stats.locator('.field-row').filter({ hasText: '1 / 1回答 正解' });
  expect(await studied.count()).toBeGreaterThan(0);
  await studied.first().getByRole('button').click();
  await expect(stats.locator('.field-overview .field-counts')).toContainText('1 / 1回答 正解');
  await page.reload();
  await page.getByRole('button', { name: '記録', exact: true }).click();
  await expect(stats.locator('.field-overview .field-counts')).toContainText('1 / 1回答 正解');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
