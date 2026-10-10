import { existsSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import historical from '../../src/data/packs/historical.json' with { type: 'json' };
const key='care-manager-quest:v1';
for(const year of [2020,2021,2022,2023,2024]) {
 test(`${year}: year filter, text UI, exact grading, original image, reload and history`,async({page})=>{
  await page.goto('/');
  await page.getByLabel('出題する年度').selectOption(String(year));
  await page.getByRole('button',{name:'5問のクエストを始める'}).click();
  const id=await page.evaluate(k=>{const p=JSON.parse(localStorage.getItem(k)!);return p.session.questionIds[0];},key);
  const q=historical.find(q=>q.id===id)!;
  expect(q.original.year).toBe(year);
  await expect(page.locator('.question-stem')).toHaveText(q.stem);
  const buttons=page.getByRole('group',{name:'解答の選択肢'}).getByRole('button');
  for(const option of q.options)await expect(buttons.nth(Number(option.id)-1)).toContainText(option.text);
  await page.getByRole('button',{name:'原本画像を見る ↗'}).click();
  const img=page.getByRole('dialog').locator('img');
  if(existsSync(new URL(`../../public${q.original.imagePath}`,import.meta.url))) {
   await expect(img).toHaveAttribute('src',q.original.imagePath);
   expect(await img.evaluate((e:HTMLImageElement)=>e.complete&&e.naturalWidth>0)).toBe(true);
  } else await expect(page.getByRole('dialog').getByRole('alert')).toContainText('公式PDF');
  await expect(page.getByRole('dialog').getByRole('link',{name:'公式問題PDFで原本を確認する ↗'})).toHaveAttribute('href',q.original.sourceUrl);
  await page.getByRole('button',{name:'元の画面へ戻る'}).click();
  for(const answer of q.answerIds)await buttons.nth(Number(answer)-1).click();
  await page.getByRole('button',{name:'答えを確定する'}).click();
  await expect(page.locator('#feedback')).toContainText('正解！');
  await expect(page.locator('#feedback')).toContainText(`${year}年度試験当時`);
  const before=await page.evaluate(k=>localStorage.getItem(k),key);
  await page.getByRole('button',{name:'中断してホーム'}).click();
  await page.getByLabel('出題する年度').selectOption('2025');
  await page.reload();
  await expect(page.locator('.question-title')).toContainText(`${year}年度`);
  expect(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!),key)).toEqual(JSON.parse(before!));
  await page.getByRole('button',{name:'中断してホーム'}).click();
  await expect(page.getByLabel('出題する年度')).toHaveValue('2025');
 });
}
test('all years labels count the selected pool and retain default 2025 preference',async({page})=>{
 await page.goto('/');await expect(page.getByLabel('出題する年度')).toHaveValue('2025');
 await page.getByLabel('出題する年度').selectOption('all');
 await expect(page.getByRole('radio',{name:'介護支援（150問）'})).toBeChecked();
 await page.getByRole('radio',{name:'全分野（360問）'}).check();
 await expect(page.getByText('現在の出題：360問')).toBeVisible();
});
