import { test, expect, type Page } from '@playwright/test';

async function stubClipboard(page: Page, denied = false) {
  await page.addInitScript(denied => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text: string) => {
      if (denied) throw new Error('denied');
      (window as unknown as { copied: string }).copied = text;
    } } });
  }, denied);
}
async function copied(page: Page) { return page.evaluate(() => (window as unknown as { copied: string }).copied); }
function payload(prompt: string, explanation = '試験当時の制度に沿った、短い覚えるポイント。') {
  return JSON.stringify({ ...JSON.parse(prompt.match(/```json\n([\s\S]*?)\n```/)![1]), explanation });
}
async function paste(page: Page, text: string) {
  await page.getByRole('button', { name: /短い解説を貼り(付ける|替える)/ }).click();
  await page.getByLabel('アプリ用の短い解説を貼り付け', { exact: true }).fill(text);
  await page.getByRole('button', { name: '短い解説を保存', exact: true }).click();
}

test('swipe copy, paste, wrong-card guard, persistence, replacement and deletion', async ({ page }) => {
  await stubClipboard(page);
  // Make an overdue mistake win over the many unseen cards when revisiting it.
  await page.addInitScript(() => { Math.random = () => 0.99; });
  await page.clock.install({ time: new Date('2026-10-11T00:00:00Z') });
  await page.goto('/'); await page.getByRole('button', { name: '○×学習', exact: true }).click();
  await page.getByLabel('○×の年度').selectOption('2020');
  await page.getByRole('button', { name: '○×学習を始める', exact: true }).click();
  await page.getByRole('button', { name: '問題をコピー', exact: true }).click();
  const before = await copied(page);
  expect(before).toContain('【対象の選択肢】'); expect(before).toContain('care_manager_2020_');
  expect(before).not.toContain('【このカードの試験当時の判定】');
  await page.getByRole('button', { name: '↑ わからない', exact: true }).click();
  await page.getByRole('button', { name: '問題をコピー', exact: true }).click();
  const after = await copied(page); expect(after).toContain('【自分の○×解答】わからない');
  const short = payload(after);
  await paste(page, '```json\n' + short + '\n```');
  await expect(page.locator('.saved-explanation')).toContainText('短い覚えるポイント');
  const firstText = await page.locator('.swipe-card p').textContent();
  await page.screenshot({ path: `test-results/${test.info().project.name}-short-explanation.png`, fullPage: true });
  await page.getByRole('button', { name: '次のカードへ' }).click();
  await page.getByRole('button', { name: '↑ わからない', exact: true }).click();
  await paste(page, short);
  await expect(page.getByRole('alert')).toContainText('別の問題・選択肢');
  await expect(page.locator('.saved-explanation')).toHaveCount(0);
  await page.getByRole('button', { name: '分野選択に戻る' }).click();
  // Keep only the original mistaken card in review history; weighted selection
  // deterministically revisits it after the full one-day cooldown.
  await page.evaluate(() => {
    const key = 'care-manager-quest:swipe:v1', state = JSON.parse(localStorage.getItem(key)!);
    const ids = Object.keys(state.progress); delete state.progress[ids[1]];
    localStorage.setItem(key, JSON.stringify(state));
  });
  await page.clock.fastForward(86_400_001); await page.reload();
  await page.getByLabel('○×の年度').selectOption('2020');
  await page.getByRole('button', { name: '○×学習を始める', exact: true }).click();
  await expect(page.locator('.swipe-card p')).toHaveText(firstText!);
  await expect(page.locator('.saved-explanation')).toHaveCount(0);
  await page.getByRole('button', { name: '↑ わからない', exact: true }).click();
  await expect(page.locator('.saved-explanation')).toContainText('短い覚えるポイント');
  await paste(page, JSON.stringify({ ...JSON.parse(short), explanation: '更新後の短い解説' }));
  await expect(page.locator('.saved-explanation')).toHaveText('更新後の短い解説');
  await page.getByRole('button', { name: '保存した解説を削除', exact: true }).click();
  await expect(page.locator('.saved-explanation')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('normal mode short explanation stays with its problem and is visible in details', async ({ page }) => {
  await stubClipboard(page); await page.goto('/');
  await page.getByRole('button', { name: '5問のクエストを始める' }).click();
  await page.getByRole('button', { name: '問題をコピー', exact: true }).click();
  const prompt = await copied(page);
  const options = page.getByRole('group', { name: '解答の選択肢' }).getByRole('button');
  const count = Number((await page.locator('.selection-instruction b').textContent())!.match(/\d/)![0]);
  for (let i = 0; i < count; i++) await options.nth(i).click();
  await page.getByRole('button', { name: '答えを確定する' }).click();
  await paste(page, payload(prompt));
  await page.getByRole('button', { name: '詳しく見る', exact: true }).click();
  await expect(page.getByRole('dialog').locator('.saved-explanation')).toContainText('短い覚えるポイント');
  await page.getByRole('button', { name: '元の画面へ戻る' }).click();
  await page.reload();
  await expect(page.locator('.saved-explanation')).toContainText('短い覚えるポイント');
  await page.getByRole('button', { name: '次の問題へ' }).click();
  await expect(page.locator('.saved-explanation')).toHaveCount(0);
});

test('swipe manual copy fallback and failed storage do not report a successful save', async ({ page }) => {
  await stubClipboard(page, true); await page.goto('/');
  await page.getByRole('button', { name: '○×学習', exact: true }).click();
  await page.getByRole('button', { name: '○×学習を始める', exact: true }).click();
  await page.getByRole('button', { name: '問題をコピー', exact: true }).click();
  const prompt = await page.getByLabel('ChatGPTに貼り付ける文章').inputValue();
  expect(prompt).toContain('【対象の選択肢】');
  await page.getByRole('button', { name: '↑ わからない', exact: true }).click();
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key.startsWith('care-manager-quest:explanation:')) throw new Error('解説の保存領域を利用できません');
      return original.call(this, key, value);
    };
  });
  await paste(page, payload(prompt));
  await expect(page.getByRole('alert')).toContainText('保存領域を利用できません');
  await expect(page.locator('.saved-explanation')).toHaveCount(0);
  await expect(page.getByLabel('アプリ用の短い解説を貼り付け', { exact: true })).toHaveValue(payload(prompt));
});
