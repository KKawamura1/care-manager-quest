import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
const truth = JSON.parse(readFileSync(new URL('../../data/choice-tf/choice-answers-2005-2025.json', import.meta.url), 'utf8')).questions;
const key = 'care-manager-quest:swipe:v1';
const playerKey = 'care-manager-quest:v1';
async function open(page: Page) {
  await page.goto('/'); await page.getByRole('button', { name: '○×学習', exact: true }).click();
}
async function start(page: Page) { await page.getByRole('button', { name: '○×学習を始める', exact: true }).click(); }
async function currentTruth(page: Page) {
  const meta = await page.locator('.swipe-screen .question-meta').textContent();
  const match = meta!.match(/(\d{4})年度 問(\d+)・選択肢(\d)/)!;
  return truth[`${match[1]}-${match[2].padStart(2, '0')}`].choiceAnswers[Number(match[3]) - 1] === '○';
}
async function progress(page: Page) { return page.evaluate(k => JSON.parse(localStorage.getItem(k)!).progress, key); }
async function drag(page: Page, dx: number, dy = 0) {
  const card = page.getByRole('group', { name: '○×カード', exact: true });
  await card.scrollIntoViewIfNeeded(); const box = (await card.boundingBox())!;
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + dx, y + dy, { steps: 8 }); await page.mouse.up();
}
test('right/left swipe, feedback, duplicate guard and navigation preserve five-choice session and XP', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/'); await page.getByRole('button', { name: '5問のクエストを始める' }).click();
  await page.getByRole('group', { name: '解答の選択肢' }).getByRole('button').first().click();
  const original = await page.evaluate(k => localStorage.getItem(k), playerKey);
  await page.getByRole('button', { name: '○×学習', exact: true }).click();
  await page.screenshot({ path: `test-results/${test.info().project.name}-swipe-setup.png`, fullPage: true });
  await start(page); await expect(page.locator('.swipe-context')).not.toBeEmpty();
  await drag(page, 90); await expect(page.locator('.swipe-verdict')).toContainText('あなた：○');
  await expect.poll(async () => Object.values(await progress(page)).length).toBe(1);
  await expect(page.getByRole('button', { name: '次のカードへ' })).toBeFocused();
  await page.getByRole('group', { name: '○×カード', exact: true }).press('ArrowLeft');
  expect(Object.values(await progress(page))).toHaveLength(1);
  await page.screenshot({ path: `test-results/${test.info().project.name}-swipe-feedback.png`, fullPage: true });
  await page.getByRole('button', { name: '次のカードへ' }).click(); await drag(page, -90);
  await expect(page.locator('.swipe-verdict')).toContainText('あなた：×');
  await page.getByRole('button', { name: '冒険', exact: true }).click();
  await page.getByRole('button', { name: '○×学習', exact: true }).click();
  await expect(page.locator('.swipe-verdict')).toContainText('あなた：×');
  expect(await page.evaluate(k => localStorage.getItem(k), playerKey)).toBe(original);
  await page.reload(); await expect(page.getByRole('group', { name: '解答の選択肢' }).getByRole('button').first()).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(k => localStorage.getItem(k), playerKey)).toBe(original);
  expect(Object.values(await progress(page))).toHaveLength(2); expect(errors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('short/vertical drags do not answer; arrow key and buttons do; narrow topic and 2020 IDs resolve correctly', async ({ page }) => {
  await open(page); await page.getByLabel('○×の年度').selectOption('2020');
  const option = await page.getByLabel('学ぶ知識分野').locator('optgroup option').first().getAttribute('value');
  await page.getByLabel('学ぶ知識分野').selectOption(option!); await start(page);
  await expect(page.locator('.swipe-screen .question-meta')).toContainText('2020年度');
  const target = await page.locator('.swipe-topic').textContent(); expect(target).not.toContain('未確認');
  await drag(page, 20); await expect(page.locator('.swipe-verdict')).toHaveCount(0);
  await drag(page, 20, 80); await expect(page.locator('.swipe-verdict')).toHaveCount(0);
  expect(Object.keys(await progress(page))).toHaveLength(0);
  await page.getByRole('group', { name: '○×カード', exact: true }).press('ArrowRight');
  await expect(page.locator('.swipe-verdict')).toContainText('あなた：○');
  await page.getByRole('button', { name: '次のカードへ' }).click();
  await expect(page.locator('.swipe-topic')).toHaveText(target!);
  await page.getByRole('button', { name: '×と答える', exact: true }).click();
  await expect(page.locator('.swipe-verdict')).toContainText('あなた：×');
  expect(Object.keys(await progress(page)).every(id => id.startsWith('care_manager_2020_'))).toBe(true);
});

test('due mistakes are prioritized after reload and successful cards are deferred', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-11T00:00:00Z') });
  await open(page); await start(page);
  const expected = await currentTruth(page);
  await page.getByRole('button', { name: expected ? '×と答える' : '○と答える', exact: true }).click();
  await expect(page.locator('.swipe-verdict')).toBeVisible();
  const firstText = await page.locator('.swipe-card p').textContent();
  const wrongId = Object.keys(await progress(page))[0];
  await page.getByRole('button', { name: '分野選択に戻る' }).click();
  await start(page); expect(await page.locator('.swipe-card p').textContent()).not.toBe(firstText);
  await page.getByRole('button', { name: '分野選択に戻る' }).click();
  await page.clock.runFor(61_000); await page.reload();
  await page.getByRole('button', { name: '○×学習', exact: true }).click(); await start(page);
  await expect(page.locator('.swipe-card p')).toHaveText(firstText!);
  await page.getByRole('button', { name: expected ? '○と答える' : '×と答える', exact: true }).click();
  await expect(page.getByRole('heading', { name: '正解！', exact: true })).toBeVisible();
  const p = (await progress(page))[wrongId]; expect(p.reviews).toBe(2); expect(p.streak).toBe(1);
  expect(Date.parse(p.dueAt) - Date.parse(p.lastReviewedAt)).toBe(86_400_000);
});

test('20-card recall, backup preview/cancel/import and invalid input keep review records safe', async ({ page }) => {
  await open(page); await page.getByLabel('○×の年度').selectOption('2025');
  await page.getByLabel('学ぶ知識分野').selectOption('unclassified'); await start(page);
  for (let i = 0; i < 20; i++) {
    const answer = await currentTruth(page);
    await page.getByRole('button', { name: answer ? '○と答える' : '×と答える', exact: true }).click();
    await expect(page.locator('.swipe-verdict')).toBeVisible();
    await page.getByRole('button', { name: i === 19 ? '学習結果を見る' : '次のカードへ', exact: true }).click();
  }
  await expect(page.getByRole('status')).toContainText('20枚中 20枚正解');
  const raw = await page.evaluate(k => localStorage.getItem(k)!, key);
  expect(Object.keys(await progress(page))).toHaveLength(20);
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: '○×履歴を書き出す', exact: true }).click();
  expect((await download).suggestedFilename()).toBe('care-manager-swipe-history.json');
  const file = page.locator('.swipe-screen input[type=file]');
  await file.setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{}') });
  await expect(page.getByRole('status').filter({ hasText: '形式が不正' })).toBeVisible();
  expect(await page.evaluate(k => localStorage.getItem(k), key)).toBe(raw);
  await file.setInputFiles({ name: 'good.json', mimeType: 'application/json', buffer: Buffer.from(raw) });
  await expect(page.getByRole('heading', { name: '○×履歴の読み込み確認' })).toBeVisible();
  await page.getByRole('button', { name: 'キャンセル', exact: true }).click();
  expect(await page.evaluate(k => localStorage.getItem(k), key)).toBe(raw);
  await file.setInputFiles({ name: 'good.json', mimeType: 'application/json', buffer: Buffer.from(raw) });
  await page.getByRole('button', { name: '○×履歴を置き換える', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: '○×履歴を読み込みました' })).toBeVisible();
  await page.reload(); expect(await page.evaluate(k => localStorage.getItem(k), key)).toBe(raw);
});

test('corrupt swipe storage is preserved until explicit recovery, while five-choice learning remains usable', async ({ page }) => {
  await page.addInitScript(k => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem(k, '{broken'); sessionStorage.setItem('seeded', 'yes'); } }, key);
  await open(page); await expect(page.getByRole('alert')).toContainText('○×履歴');
  await expect(page.getByRole('button', { name: '○×学習を始める', exact: true })).toBeDisabled();
  expect(await page.evaluate(k => localStorage.getItem(k), key)).toBe('{broken');
  await page.getByRole('button', { name: '冒険', exact: true }).click();
  await expect(page.getByRole('button', { name: '5問のクエストを始める' })).toBeEnabled();
  await page.getByRole('button', { name: '○×学習', exact: true }).click();
  await page.getByRole('button', { name: '新しい○×履歴で始める' }).click();
  await expect(page.getByRole('button', { name: '○×学習を始める', exact: true })).toBeEnabled();
  expect(await page.evaluate(k => localStorage.getItem(k), key)).not.toBe('{broken');
});

test('native touch swipe submits on mobile Chromium', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'CDP touch events are supported by Chromium only');
  await open(page); await start(page);
  const card = page.getByRole('group', { name: '○×カード', exact: true }); await card.scrollIntoViewIfNeeded();
  const box = (await card.boundingBox())!, x = box.x + box.width / 2, y = box.y + box.height / 2;
  const session = await page.context().newCDPSession(page);
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  for (let dx = 15; dx <= 90; dx += 15) await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + dx, y }] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(page.locator('.swipe-verdict')).toContainText('あなた：○');
});

test('denied storage access does not crash the app or overwrite unknown swipe history', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new Error('storage denied'); } }));
  await open(page);
  await expect(page.locator('.swipe-screen [role=alert]')).toContainText('保存領域を利用できません');
  await expect(page.getByRole('button', { name: '○×学習を始める', exact: true })).toBeDisabled();
  expect(errors).toEqual([]);
});
