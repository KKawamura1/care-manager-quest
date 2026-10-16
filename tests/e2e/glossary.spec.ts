import { test, expect, type Page } from '@playwright/test';
import catalog from '../../src/data/packs/knowledge.json' with {type:'json'};
import questions from '../../src/data/packs/2025/questions.json' with {type:'json'};
import { glossaryTerms } from '../../src/data/glossary';
import { splitGlossaryText } from '../../src/domain/glossary';

const key = 'care-manager-quest:learning:v3';
const termsIn = (text: string) => splitGlossaryText(text, glossaryTerms).filter(part => part.term);
const swipeCards = questions.flatMap(question => question.choices.map((text, index) => ({
  year: 2025, stem: question.stem, text,
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

test('term taps and dialog keys preserve the card, history and answer; closing restores focus', async ({page}) => {
  await start(page);
  const before = await page.evaluate(key => localStorage.getItem(key), key);
  const button = page.locator('.swipe-card .glossary-term').first();
  const part = termsIn(fixture.first.text)[0];
  await button.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toHaveAccessibleName(part.term!.label);
  await expect(dialog).toContainText(part.term!.description);
  await expect(dialog.getByRole('link',{name:'出典を確認 ↗'})).toHaveAttribute('href',part.term!.sourceUrl);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowUp');
  await expect(page.locator('#swipe-feedback')).toHaveCount(0);
  expect(await page.evaluate(key => localStorage.getItem(key),key)).toBe(before);
  await dialog.getByRole('button',{name:'閉じる',exact:true}).click();
  await expect(button).toBeFocused();
  await button.press('ArrowRight');
  await expect(page.locator('#swipe-feedback')).toHaveCount(0);
  await button.press('Enter');
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(button).toBeFocused();
  await page.locator('.swipe-context .glossary-term').first().click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'○と答える',exact:true}).click();
  const answered = await page.evaluate(key => localStorage.getItem(key),key);
  await button.click();
  await page.keyboard.press('ArrowLeft');
  await expect(dialog).toBeVisible();
  await expect(page.locator('#swipe-feedback')).toBeVisible();
  await page.keyboard.press('Escape');
  expect(await page.evaluate(key => localStorage.getItem(key),key)).toBe(answered);
  await expect(page.locator('.swipe-card p')).toHaveText(fixture.first.text);
  await page.getByRole('button',{name:'次のカードへ',exact:true}).click();
  await expect(dialog).toHaveCount(0);
});

test('terms wrap on narrow screens and their dialog stays inside the viewport', async ({page}) => {
  await page.setViewportSize({width:320,height:700});
  await start(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('.swipe-card .glossary-term').first().tap();
  await expect(page.getByRole('dialog')).toBeVisible();
  const box = (await page.getByRole('dialog').boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(320);
  await page.screenshot({path:`test-results/glossary-${test.info().project.name}.png`});
  await page.keyboard.press('Escape');
  await page.screenshot({path:`test-results/glossary-card-${test.info().project.name}.png`});
});
