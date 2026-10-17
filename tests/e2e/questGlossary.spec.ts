import { test, expect, type Page } from '@playwright/test';
import questions from '../../src/data/packs/2025/questions.json' with {type:'json'};
import answers from '../../src/data/packs/2025/answers.json' with {type:'json'};
import { glossaryTerms } from '../../src/data/glossary';
import { splitGlossaryText } from '../../src/domain/glossary';

const key = 'care-manager-quest:learning:v3';
const terms = (text: string) => splitGlossaryText(text, glossaryTerms).filter(part => part.term);
const question = questions.find(q => terms(q.stem).length > 0 && q.choices.filter(text => terms(text).length).length >= 3)!;
const correctIds = (answers as Record<string,{correctChoices:number[]}>)[question.id].correctChoices.map(String);
const snapshot = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!),key);

for (const correct of [true, false]) {
  test(`five-choice glossary is absent before grading and opens after ${correct ? 'correct' : 'incorrect'} answers without altering the result`, async ({page}) => {
    await page.setViewportSize({width:320,height:740});
    const remaining = questions.filter(q => q.id !== question.id).slice(0,4).map(q => q.id);
    await page.addInitScript(({key,ids}) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key,JSON.stringify({schemaVersion:3,learningEvents:[],attempts:[],concepts:{},externalRecords:[],settings:{sound:false},session:{id:'glossary-quest',questionIds:ids,index:0,selectedIds:[],completed:false}}));
    },{key,ids:[question.id,...remaining]});
    await page.goto('/');
    await expect(page.locator('.play-screen .glossary-term')).toHaveCount(0);
    const options = page.locator('.options > button');
    await expect(options).toHaveCount(5);
    const ids = correct ? correctIds : [...correctIds.slice(1),question.choices.map((_,i) => String(i+1)).find(id => !correctIds.includes(id))!];
    for (const id of ids) await options.nth(Number(id)-1).click();
    await expect(page.locator('.play-screen .glossary-term')).toHaveCount(0);
    await page.getByRole('button',{name:'答えを確定する'}).click();
    await expect(page.locator('#feedback h2')).toHaveText(correct ? '正解' : '不正解');
    await expect(page.locator('.options > .option')).toHaveCount(5);
    await expect(page.locator('.options > button')).toHaveCount(0);
    await expect(page.locator('.options button button')).toHaveCount(0);
    await page.locator('.question-stem').scrollIntoViewIfNeeded();
    await page.screenshot({path:`test-results/quest-glossary-${correct ? 'correct' : 'incorrect'}-${test.info().project.name}.png`,fullPage:true});
    const recorded = await snapshot(page);
    const buttons = page.locator('.question-stem .glossary-term, .options .glossary-term');
    for (let i=0; i<await buttons.count(); i++) {
      const button = buttons.nth(i);
      await button.click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).not.toHaveAccessibleName('用語解説を見ますか？');
      await expect(dialog.getByRole('link',{name:'出典を確認 ↗'})).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(button).toBeFocused();
      expect(await snapshot(page)).toEqual(recorded);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('button',{name:'詳しく見る',exact:true}).click();
    const detail = page.getByRole('dialog',{name:'詳しく見る',exact:true});
    const detailTerm = detail.locator('.glossary-term').first();
    await detailTerm.click();
    const termLabel = terms(question.stem)[0].term!.label;
    const glossary = page.getByRole('dialog',{name:termLabel,exact:true});
    await expect(glossary).toBeVisible();
    await expect(page.locator('dialog[open]')).toHaveCount(2);
    await page.keyboard.press('Escape');
    await expect(detail).toBeVisible();
    await expect(detailTerm).toBeFocused();
    await detail.getByRole('button',{name:'元の画面へ戻る'}).click();
    expect(await snapshot(page)).toEqual(recorded);
    await page.reload();
    await expect(page.locator('.question-stem .glossary-term').first()).toBeVisible();
    expect(await snapshot(page)).toEqual(recorded);
    await page.getByRole('button',{name:'次の問題へ'}).click();
    await expect(page.locator('.play-screen .glossary-term')).toHaveCount(0);
    await expect(page.locator('.options > button')).toHaveCount(5);
  });
}
