import { test, expect } from '@playwright/test';
import pack from '../../src/data/explanations/2025.json' with { type: 'json' };
const key = 'care-manager-quest:learning:v3';
const entry = pack.find(q => q.number === 4)!;

for (const correct of [true,false]) {
  test(`5-choice built-in explanations appear only after grading (${correct}) and survive reload`, async ({page}) => {
    await page.setViewportSize({ width: 320, height: 740 });
    await page.addInitScript(key => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({
        schemaVersion:3, learningEvents:[], attempts:[], concepts:{}, externalRecords:[], settings:{sound:false},
        session:{id:'bundled-explanations',questionIds:['2025-04','2025-05','2025-06','2025-07','2025-08'],index:0,selectedIds:[],completed:false},
      }));
    }, key);
    await page.goto('/');
    await expect(page.locator('.bundled-explanation')).toHaveCount(0);
    await expect(page.getByText(entry.overview,{exact:true})).toHaveCount(0);
    for (const id of correct ? ['3','4','5'] : ['1','2','3']) await page.locator('.options > button').nth(Number(id)-1).click();
    await page.getByRole('button',{name:'答えを確定する'}).click();
    await expect(page.locator('#feedback h2')).toHaveText(correct ? '正解' : '不正解');
    const explanation = page.locator('#feedback .bundled-explanation');
    await expect(explanation).toContainText(entry.overview);
    const before = await page.evaluate(key => localStorage.getItem(key),key);
    await explanation.getByText('選択肢別の解説を見る',{exact:true}).click();
    for (const c of entry.choices) await expect(explanation.getByText(c.explanation,{exact:true})).toBeVisible();
    await explanation.getByText('解説の参考資料',{exact:true}).click();
    await expect(explanation.getByRole('link').first()).toHaveAttribute('href',entry.sources[0].url);
    expect(await page.evaluate(key => localStorage.getItem(key),key)).toBe(before);
    await page.getByRole('button',{name:'詳しく見る',exact:true}).click();
    const detail = page.getByRole('dialog',{name:'詳しく見る',exact:true});
    for (const c of entry.choices) await expect(detail.getByText(c.explanation,{exact:true})).toBeVisible();
    await detail.getByRole('button',{name:'元の画面へ戻る'}).click();
    await page.reload();
    await expect(explanation).toContainText(entry.overview);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await explanation.getByText('選択肢別の解説を見る',{exact:true}).click();
    await page.screenshot({path:`test-results/bundled-quest-${correct}-${test.info().project.name}.png`,fullPage:true});
    await page.getByRole('button',{name:'次の問題へ'}).click();
    await expect(page.locator('.bundled-explanation')).toHaveCount(0);
    await expect(page.getByText(entry.overview,{exact:true})).toHaveCount(0);
  });
}

test('swipe shows the current choice explanation after answering and hides it for retries and next cards', async ({page}) => {
  await page.setViewportSize({width:320,height:740});
  await page.goto('/');
  await page.getByRole('button',{name:'○×学習',exact:true}).click();
  await page.getByLabel('○×の年度').selectOption('2025');
  await page.getByRole('button',{name:'○×学習を始める',exact:true}).click();
  const meta = await page.locator('.question-meta').last().textContent();
  const [,n,c] = meta!.match(/2025年度 問(\d+)・選択肢(\d+)/)!;
  const expected = pack.find(e => e.number === Number(n))!.choices.find(choice => choice.id === c)!;
  await expect(page.locator('.bundled-explanation')).toHaveCount(0);
  await expect(page.getByText(expected.explanation,{exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'↑ わからない',exact:true}).click();
  const explanation = page.locator('#swipe-feedback .bundled-explanation');
  await expect(explanation.getByText(expected.explanation,{exact:true})).toBeVisible();
  const before = await page.evaluate(key => localStorage.getItem(key),key);
  const summary = explanation.getByText('解説の参考資料',{exact:true});
  await summary.click();
  await summary.focus(); await page.keyboard.press('ArrowRight');
  await expect(explanation.getByText(expected.explanation,{exact:true})).toBeVisible();
  expect(await page.evaluate(key => localStorage.getItem(key),key)).toBe(before);
  await page.screenshot({path:`test-results/bundled-swipe-${test.info().project.name}.png`,fullPage:true});
  await page.getByRole('button',{name:'同じカードを再練習（XPなし）',exact:true}).click();
  await expect(page.locator('.bundled-explanation')).toHaveCount(0);
  await page.getByRole('button',{name:'↑ わからない',exact:true}).click();
  await expect(explanation.getByText(expected.explanation,{exact:true})).toBeVisible();
  await page.getByRole('button',{name:/次のカードへ/}).click();
  await expect(page.locator('.bundled-explanation')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
