import { test, expect, type Page } from '@playwright/test';

async function stubClipboard(page: Page, denied = false) {
  await page.addInitScript(denied => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text: string) => {
      if (denied) throw new Error('denied');
      (window as unknown as { copied: string }).copied = text;
    } } });
  }, denied);
}
function checkPrompt(prompt: string) {
  expect(prompt).toContain('docs/register-explanation.md');
  expect(prompt).toContain('登録しといて');
  expect(prompt).toContain('解説の回答の最後に、必ず「この解説をアプリに登録しますか？」と尋ねてください。');
  expect(prompt).toContain('回答への再出力不要');
  expect(prompt).not.toContain('アプリ用の短い解説');
  const target = JSON.parse(prompt.match(/```json\n([\s\S]*?)\n```/)![1]);
  expect(target).not.toHaveProperty('explanation');
  return target;
}
async function noPasteControls(page: Page) {
  await expect(page.getByRole('button', { name: /短い解説を(貼り|保存)|保存した解説を削除/ })).toHaveCount(0);
  await expect(page.getByLabel('アプリ用の短い解説を貼り付け', { exact: true })).toHaveCount(0);
  await expect(page.locator('.saved-explanation')).toHaveCount(0);
}

test('swipe copies a registration prompt and has no explanation paste route after answering or retry', async ({ page }) => {
  await stubClipboard(page); await page.goto('/');
  await page.getByRole('button', { name: '○×学習', exact: true }).click();
  await page.getByRole('button', { name: '○×学習を始める', exact: true }).click();
  await page.getByRole('button', { name: '問題をコピー', exact: true }).click();
  const target = checkPrompt(await page.evaluate(() => (window as unknown as { copied: string }).copied));
  expect(target.choiceId).toBeDefined(); expect(target.cardRevision).toBeDefined();
  // Old browser entries must not resurrect the removed local explanation UI.
  await page.evaluate(target => localStorage.setItem(`care-manager-quest:explanation:v1:${target.questionId}:${target.choiceId}`, JSON.stringify({ ...target, explanation: '以前の貼り付け解説' })), target);
  await page.getByRole('button', { name: '↑ わからない', exact: true }).click();
  await noPasteControls(page);
  await expect(page.getByText('以前の貼り付け解説')).toHaveCount(0);
  await page.getByRole('button', { name: '同じカードを再練習（XPなし）', exact: true }).click();
  await page.getByRole('button', { name: '↑ わからない', exact: true }).click();
  await noPasteControls(page);
});

test('normal mode and detail display have no explanation paste route', async ({ page }) => {
  await stubClipboard(page); await page.goto('/');
  await page.getByRole('button', { name: '5問の演習を始める' }).click();
  await page.getByRole('button', { name: '問題をコピー', exact: true }).click();
  const target = checkPrompt(await page.evaluate(() => (window as unknown as { copied: string }).copied));
  expect(target.questionRevision).toBeDefined(); expect(target.choiceId).toBeUndefined();
  const count = Number((await page.locator('.selection-instruction b').textContent())!.match(/\d/)![0]);
  const options = page.getByRole('group', { name: '解答の選択肢' }).getByRole('button');
  for (let i = 0; i < count; i++) await options.nth(i).click();
  await page.getByRole('button', { name: '答えを確定する' }).click();
  await noPasteControls(page);
  await page.getByRole('button', { name: '詳しく見る', exact: true }).click();
  await noPasteControls(page);
  await page.getByRole('button', { name: '元の画面へ戻る' }).click();
  await page.reload();
  await noPasteControls(page);
});

test('question copy still offers a manual fallback when clipboard access fails', async ({ page }) => {
  await stubClipboard(page, true); await page.goto('/');
  await page.getByRole('button', { name: '○×学習', exact: true }).click();
  await page.getByRole('button', { name: '○×学習を始める', exact: true }).click();
  await page.getByRole('button', { name: '問題をコピー', exact: true }).click();
  const prompt = await page.getByLabel('ChatGPTに貼り付ける文章').inputValue();
  expect(prompt).toContain('【対象の選択肢】');
  checkPrompt(prompt);
  await page.getByRole('button', { name: '↑ わからない', exact: true }).click();
  await noPasteControls(page);
});
