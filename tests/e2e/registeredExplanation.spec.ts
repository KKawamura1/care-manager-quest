import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { cardTarget, questionTarget } from '../../src/domain/appExplanation';
import type { Question } from '../../src/domain/models';
import type { SwipeCard } from '../../src/domain/swipe';

const root = new URL('../../',import.meta.url);
const raw = JSON.parse(readFileSync(new URL('imports/2021/questions.json',root),'utf8'));
const rows = Array.isArray(raw) ? raw : raw.questions;
const truth = JSON.parse(readFileSync(new URL('data/choice-tf/choice-answers-2005-2025.json',root),'utf8')).questions;
function qFor(number: number): Question {
  const row = rows.find((r: {number?:number;question_number?:number}) => (r.number ?? r.question_number) === number);
  return { id:row.id, version:1, stem:row.stem, options:row.choices.map((text:string,i:number) => ({id:String(i+1),text,explanation:''})), answerIds:(row.correct_choices ?? row.correct_answers).map(String) } as Question;
}
function targetFor(number: number, choiceId: string) {
  const q = qFor(number), label = truth[`2021-${String(number).padStart(2,'0')}`].choiceAnswers[Number(choiceId)-1];
  return cardTarget({id:`${q.id}:${choiceId}`,questionId:q.id,questionVersion:1,choiceId,stem:q.stem,text:q.options[Number(choiceId)-1].text,revision:`1:${label}`} as SwipeCard);
}
const key = 'care-manager-quest:learning:v3';
const questionText = 'この会話で確認した問題全体の要点です。';
const choiceText = '名義を他人に使用させることは、正当な理由があっても禁止されます。';
const swipeText = 'この会話で確認した選択肢の正誤の理由です。';
const files: URL[] = [];

// Unique, temporary records per browser project. Never overwrite real entries;
// remove only our own files, even when both projects run concurrently.
test.describe.configure({mode:'serial'});
test.beforeAll(() => {
  for (const [target,explanation] of [[questionTarget(qFor(10)),questionText],[targetFor(10,'4'),choiceText],[targetFor(1,'1'),swipeText]] as const) {
    const registrationId = randomUUID();
    const file = new URL(`data/explanations/entries/${registrationId}.json`,root);
    mkdirSync(new URL('data/explanations/entries/',root),{recursive:true});
    writeFileSync(file,JSON.stringify({schemaVersion:1,...target,explanation,registrationId,registeredAt:new Date().toISOString(),sources:[{title:'参考資料',url:'https://www.mhlw.go.jp/'}]}));
    files.push(file);
  }
});
test.afterAll(() => {
  expect(files).toHaveLength(3);
  for (const file of files) rmSync(file,{force:true});
  expect(files.every(file => !existsSync(file))).toBe(true);
});

test('one-file records appear after grading, in details and after reload, with choice-level explanations', async ({page}) => {
  await page.setViewportSize({width:320,height:740});
  await page.addInitScript(key => {
    if (!localStorage.getItem(key)) localStorage.setItem(key,JSON.stringify({schemaVersion:3,learningEvents:[],attempts:[],concepts:{},externalRecords:[],settings:{sound:false},session:{id:'registered',questionIds:['2021-10','2021-11','2021-12','2021-13','2021-14'],index:0,selectedIds:[],completed:false}}));
  },key);
  await page.goto('/');
  await expect(page.locator('.registered-explanation')).toHaveCount(0);
  for (const id of qFor(10).answerIds) await page.locator('.options > button').nth(Number(id)-1).click();
  await page.getByRole('button',{name:'答えを確定する'}).click();
  await expect(page.locator('.registered-explanation-text').filter({hasText:questionText})).toBeVisible();
  await page.getByText('選択肢別の登録解説（1件）',{exact:true}).click();
  await expect(page.locator('.registered-explanation-text').filter({hasText:choiceText})).toBeVisible();
  const before = await page.evaluate(key => localStorage.getItem(key),key);
  await page.getByRole('button',{name:'詳しく見る',exact:true}).click();
  const detail = page.getByRole('dialog',{name:'詳しく見る',exact:true});
  await expect(detail.locator('.registered-explanation-text').filter({hasText:questionText})).toBeVisible();
  await detail.getByText('選択肢別の登録解説（1件）',{exact:true}).click();
  await expect(detail.locator('.registered-explanation-text').filter({hasText:choiceText})).toBeVisible();
  await detail.getByRole('button',{name:'元の画面へ戻る'}).click();
  expect(await page.evaluate(key => localStorage.getItem(key),key)).toBe(before);
  await page.reload();
  await expect(page.locator('.registered-explanation-text').filter({hasText:questionText})).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({path:`test-results/registered-${test.info().project.name}.png`,fullPage:true});
  await page.getByRole('button',{name:'次の問題へ'}).click();
  await expect(page.locator('.registered-explanation')).toHaveCount(0);
});

test('swipe registration stays hidden before answering and returns after retry', async ({page}) => {
  await page.addInitScript(() => { Math.random = () => 0; });
  await page.goto('/');
  await page.getByRole('button',{name:'○×学習',exact:true}).click();
  await page.getByLabel('○×の年度').selectOption('2021');
  await page.getByRole('button',{name:'○×学習を始める',exact:true}).click();
  await expect(page.locator('.question-meta').last()).toContainText('2021年度 問1・選択肢1');
  await expect(page.locator('.registered-explanation')).toHaveCount(0);
  await page.getByRole('button',{name:'↑ わからない',exact:true}).click();
  await expect(page.locator('.registered-explanation-text').filter({hasText:swipeText})).toBeVisible();
  await page.getByRole('button',{name:'同じカードを再練習（XPなし）',exact:true}).click();
  await expect(page.locator('.registered-explanation')).toHaveCount(0);
  await page.getByRole('button',{name:'↑ わからない',exact:true}).click();
  await expect(page.locator('.registered-explanation-text').filter({hasText:swipeText})).toBeVisible();
  await page.getByRole('button',{name:/次のカードへ/}).click();
  await expect(page.locator('.registered-explanation-text').filter({hasText:swipeText})).toHaveCount(0);
});
