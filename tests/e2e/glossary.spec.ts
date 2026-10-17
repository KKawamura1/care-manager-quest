import { test, expect, type Page } from '@playwright/test';
import catalog from '../../src/data/packs/knowledge.json' with {type:'json'};
import truth from '../../data/choice-tf/choice-answers-2005-2025.json' with {type:'json'};
import questions from '../../src/data/packs/2025/questions.json' with {type:'json'};
import { glossaryTerms } from '../../src/data/glossary';
import { splitGlossaryText } from '../../src/domain/glossary';

const key = 'care-manager-quest:learning:v3';
const termsIn = (text: string) => splitGlossaryText(text, glossaryTerms).filter(part => part.term);
const swipeCards = questions.flatMap(question => question.choices.map((text, index) => ({
  year: 2025, stem: question.stem, text, id: `${question.id}:${index + 1}`,
  revision: `${question.version}:${(truth.questions as Record<string,{choiceAnswers:string[]}>)[question.id].choiceAnswers[index]}`,
  truth: (truth.questions as Record<string,{choiceAnswers:string[]}>)[question.id].choiceAnswers[index] === '○',
  topicIds: (catalog.choices as Record<string,{drawerIds:string[]}>)[`${question.id}:${index + 1}`].drawerIds,
})));
// Choose a real scope whose deterministic first card has terms in both texts.
const fixture = swipeCards.filter(card => card.year === 2025).map(card => ({
  scope: card.topicIds[0],
  first: swipeCards.find(other => other.year === 2025 && other.topicIds.includes(card.topicIds[0]))!,
})).find(item => item.scope && termsIn(item.first.stem).length && termsIn(item.first.text).length)!;
async function start(page: Page) {
  await page.addInitScript(scope => {
    Math.random = () => 0;
    localStorage.setItem('care-manager-quest:swipe-scope', scope);
  }, fixture.scope);
  await page.goto('/');
  await page.getByLabel('○×の年度').selectOption('2025');
  await page.getByRole('button',{name:'○×学習を始める',exact:true}).click();
  await expect(page.locator('.swipe-card p')).toHaveText(fixture.first.text);
}

const ledger = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!).learningEvents as {cardId:string;answer:boolean|null;hintUsed?:true;xp:number}[],key);
const answer = (page: Page, value: boolean | null) => page.getByRole('button',{name:value === null ? '↑ わからない' : value ? '○と答える' : '×と答える',exact:true}).click();

test('cancelled pre-answer confirmation has no effect; post-answer glossary opens directly and never changes history', async ({page}) => {
  await start(page);
  const before = await ledger(page);
  const button = page.locator('.swipe-card .glossary-term').first();
  const dialog = page.getByRole('dialog');
  for (const close of ['見ずに戻る','閉じる','Escape']) {
    await button.click();
    await expect(dialog).toHaveAccessibleName('用語解説を見ますか？');
    await expect(dialog.getByRole('link')).toHaveCount(0);
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#swipe-feedback')).toHaveCount(0);
    if (close === 'Escape') await page.keyboard.press('Escape');
    else await dialog.getByRole('button',{name:close,exact:true}).click();
    await expect(button).toBeFocused();
    expect(await ledger(page)).toEqual(before);
  }
  await answer(page,fixture.first.truth);
  await expect(page.locator('#swipe-feedback')).toContainText('正解！');
  const recorded = await ledger(page);
  expect(recorded.at(-1)).toMatchObject({answer:fixture.first.truth,xp:10});
  expect(recorded.at(-1)).not.toHaveProperty('hintUsed');
  for (const selector of ['.swipe-card .glossary-term','.swipe-context .glossary-term']) {
    await page.locator(selector).first().click();
    await expect(dialog).not.toHaveAccessibleName('用語解説を見ますか？');
    await expect(dialog.getByRole('link',{name:'出典を確認 ↗'})).toBeVisible();
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('Escape');
    expect(await ledger(page)).toEqual(recorded);
    await expect(page.locator('#swipe-feedback')).toContainText('正解！');
  }
});

for (const outcome of ['correct','incorrect','unknown'] as const) {
  test(`pre-answer viewing scores ${outcome} answers as incorrect, shares the flag across both texts and preserves it after reload`, async ({page}) => {
    await start(page);
    const dialog = page.getByRole('dialog');
    await page.locator('.swipe-context .glossary-term').first().click();
    await dialog.getByRole('button',{name:'解説を見る（不正解扱い）',exact:true}).click();
    await expect(dialog.getByRole('link',{name:'出典を確認 ↗'})).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByText('用語解説を閲覧済み：今回は不正解として記録します。')).toBeVisible();
    await page.locator('.swipe-card .glossary-term').first().click();
    await expect(dialog.getByRole('link',{name:'出典を確認 ↗'})).toBeVisible();
    await page.keyboard.press('ArrowUp');
    expect(await ledger(page)).toHaveLength(0);
    await page.keyboard.press('Escape');
    const value = outcome === 'unknown' ? null : outcome === 'correct' ? fixture.first.truth : !fixture.first.truth;
    await answer(page,value);
    await expect(page.locator('#swipe-feedback')).toContainText('学習記録は不正解扱い');
    if (outcome === 'correct') await expect(page.locator('#swipe-feedback h2')).toContainText('正解！');
    const recorded = await ledger(page);
    expect(recorded).toHaveLength(1);
    expect(recorded[0]).toMatchObject({cardId:fixture.first.id,answer:value,hintUsed:true,xp:2});
    await page.getByRole('button',{name:'同じカードを再練習（XPなし）',exact:true}).click();
    await page.locator('.swipe-card .glossary-term').first().click();
    await expect(dialog.getByRole('link',{name:'出典を確認 ↗'})).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByText('用語解説を閲覧済み：今回は不正解として記録します。')).toBeVisible();
    await page.getByRole('button',{name:'記録',exact:true}).click();
    await expect(page.locator('.record-stats > div').nth(2).locator('b')).toHaveText('0');
    await page.reload();
    expect(await ledger(page)).toEqual(recorded);
    await page.getByRole('button',{name:'記録',exact:true}).click();
    await expect(page.locator('.record-stats > div').nth(2).locator('b')).toHaveText('0');
  });
}

test('confirmation and definition fit a narrow touch screen; closing returns focus', async ({page}) => {
  await page.setViewportSize({width:320,height:700});
  await start(page);
  const button = page.locator('.swipe-card .glossary-term').first();
  await button.tap();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toHaveAccessibleName('用語解説を見ますか？');
  await page.screenshot({path:`test-results/glossary-confirm-${test.info().project.name}.png`});
  await dialog.getByRole('button',{name:'解説を見る（不正解扱い）',exact:true}).tap();
  const box = (await dialog.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(320);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({path:`test-results/glossary-${test.info().project.name}.png`});
  await page.keyboard.press('Escape');
  await expect(button).toBeFocused();
});

test('saved hint consent bypasses confirmation on another day, still records hinted failures and leaves unviewed attempts normal', async ({page}) => {
  const previous = swipeCards.filter(card => card.topicIds.includes(fixture.scope)).map(card => ({cardId:card.id,revision:card.revision,answer:card.truth,hintUsed:true,xp:2,bonusXp:0,mode:'swipe',at:'2020-01-01T00:00:00Z'}));
  await page.addInitScript(({key,previous}) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key,JSON.stringify({schemaVersion:3,learningEvents:previous,attempts:[],concepts:{},externalRecords:[],settings:{sound:false}}));
  },{key,previous});
  await start(page);
  await page.locator('.swipe-card .glossary-term').first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('link',{name:'出典を確認 ↗'})).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByText('用語解説を閲覧済み：今回は不正解として記録します。')).toBeVisible();
  await answer(page,fixture.first.truth);
  expect((await ledger(page)).at(-1)).toMatchObject({answer:fixture.first.truth,hintUsed:true,xp:2});
  await page.getByRole('button',{name:'同じカードを再練習（XPなし）',exact:true}).click();
  await answer(page,fixture.first.truth);
  expect((await ledger(page)).at(-1)).not.toHaveProperty('hintUsed');
  await expect(page.locator('#swipe-feedback')).not.toContainText('学習記録は不正解扱い');
});
