import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
const raw = JSON.parse(readFileSync(new URL('../../src/data/packs/2025/questions.json', import.meta.url), 'utf8')) as { id: string; number: number; stem: string }[];
const answers = JSON.parse(readFileSync(new URL('../../src/data/packs/2025/answers.json', import.meta.url), 'utf8')) as Record<string, { correctChoices: number[] }>;
const questions = raw.map(question => ({ ...question, title: `2025年度 問${question.number}｜`, answerIds: answers[question.id].correctChoices.map(String) }));
const key = 'care-manager-quest:v1';

test('copies the current question before answering, then includes answer and choices in feedback and details', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      writeText: async (text: string) => { (window as unknown as { copied: string }).copied = text; },
    } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: '5問のクエストを始める' }).click();
  const id = await page.evaluate(k => { const session = JSON.parse(localStorage.getItem(k)!).session; return session.questionIds[session.index]; }, key);
  const question = questions.find(question => question.id === id)!;
  const copyButton = page.getByRole('button', { name: '問題をコピー', exact: true });
  await copyButton.click();
  await expect(page.getByText('コピーしました')).toBeVisible();
  const copied = () => page.evaluate(() => (window as unknown as { copied: string }).copied);
  expect(await copied()).toContain(question.stem);
  expect(await copied()).not.toContain('【試験当時の公式正答】');
  for (const id of question.answerIds) await page.getByRole('group', { name: '解答の選択肢' }).getByRole('button').nth(Number(id) - 1).click();
  await page.getByRole('button', { name: '答えを確定する' }).click();
  await copyButton.click();
  expect(await copied()).toContain(`【試験当時の公式正答】\n${question.answerIds.join('・')}`);
  expect(await copied()).toContain(`【自分の解答】${question.answerIds.join('・')}`);
  await page.getByRole('button', { name: '詳しく見る', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '問題をコピー', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('コピーしました');
  await page.getByRole('button', { name: '元の画面へ戻る' }).click();
  await page.getByRole('button', { name: '次の問題へ' }).click();
  await expect(page.getByText('コピーしました')).toHaveCount(0);
  await copyButton.click();
  expect(await copied()).not.toContain('【試験当時の公式正答】');
  expect(await copied()).not.toContain(question.title);
});

for (const mode of ['denied', 'unavailable'] as const) {
  test(`manual copy remains available when clipboard is ${mode}, including image-first questions`, async ({ page }) => {
    await page.addInitScript(({ mode, key }) => {
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: mode === 'unavailable' ? undefined : {
        writeText: async () => { throw new DOMException('Denied', 'NotAllowedError'); },
      } });
      localStorage.setItem(key, JSON.stringify({ schemaVersion: 2, attempts: [], concepts: {}, externalRecords: [], settings: { sound: false },
        session: { id: 'copy', questionIds: ['2025-24', '2025-25', '2025-01', '2025-02', '2025-03'], index: 0, selectedIds: [], completed: false } }));
    }, { mode, key });
    await page.goto('/');
    await page.getByRole('button', { name: '問題をコピー', exact: true }).click();
    const textarea = page.getByLabel('ChatGPTに貼り付ける文章');
    await expect(textarea).toBeVisible();
    await expect(textarea).toHaveValue(/文字校正が未完了/);
    expect(await textarea.inputValue()).toContain(questions.find(question => question.id === '2025-24')!.stem);
    await page.getByRole('button', { name: '全文を選択' }).click();
    expect(await textarea.evaluate((element: HTMLTextAreaElement) => element.selectionEnd - element.selectionStart)).toBe((await textarea.inputValue()).length);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('group', { name: '解答の選択肢' }).getByRole('button').first().click();
    expect(await page.evaluate(k => JSON.parse(localStorage.getItem(k)!).session.selectedIds, key)).toEqual(['1']);
  });
}
