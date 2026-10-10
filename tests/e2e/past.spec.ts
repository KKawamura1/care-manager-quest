import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
const key='care-manager-quest:v1';
const answers=JSON.parse(readFileSync(new URL('../../src/data/packs/pre2018/2005/answers.json',import.meta.url),'utf8'));

test('historical year, text-only questions, feedback, copy and saved selection work on mobile',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async(text:string)=>{(window as unknown as {copied:string}).copied=text;}}}));
  await page.goto('/');
  await page.getByRole('combobox',{name:'出題する年度'}).selectOption('2005');
  await page.getByRole('radio',{name:'保健医療（19問）'}).check();
  await page.getByRole('button',{name:'5問のクエストを始める'}).click();
  const state=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!),key);
  expect(state.session.questionIds.every((id:string)=>id.startsWith('2005-')&&Number(id.split('-')[1])>=26&&Number(id.split('-')[1])<=45&&id!=='2005-28')).toBe(true);
  const id=state.session.questionIds[0];
  await expect(page.locator('.question-title')).toContainText('2005年度');
  await expect(page.locator('.question-stem')).not.toBeEmpty();
  await expect(page.getByRole('group',{name:'解答の選択肢'}).getByRole('button')).toHaveCount(5);
  await expect(page.getByRole('button',{name:'原本画像を見る ↗'})).toHaveCount(0);
  await expect(page.getByRole('link',{name:'掲載元で問題を確認 ↗'})).toHaveAttribute('href',/exampress.jp/);
  await page.getByRole('button',{name:'問題をコピー',exact:true}).click();
  expect(await page.evaluate(()=>(window as unknown as {copied:string}).copied)).toContain('出題年度：2005年度');
  await page.screenshot({path:`test-results/${test.info().project.name}-past-question.png`,fullPage:true});
  for(const n of answers[id].correctChoices)await page.getByRole('group',{name:'解答の選択肢'}).getByRole('button').nth(n-1).click();
  await page.getByRole('button',{name:'答えを確定する'}).click();
  await expect(page.locator('#feedback')).toContainText('正解！');
  await expect(page.locator('#feedback')).toContainText('2005年度試験当時の正答');
  await page.getByRole('button',{name:'詳しく見る'}).click();
  await expect(page.getByRole('dialog')).toContainText('2005年度試験当時の正答');
  await expect(page.getByRole('dialog').locator('img')).toHaveCount(0);
  await page.getByRole('button',{name:'元の画面へ戻る'}).click();
  await page.reload();await expect(page.getByRole('button',{name:'次の問題へ'})).toBeVisible();
  await page.getByRole('button',{name:'中断してホーム'}).click();
  await expect(page.getByRole('combobox',{name:'出題する年度'})).toHaveValue('2005');
  await page.getByRole('combobox',{name:'出題する年度'}).selectOption('2025');
  await page.getByRole('button',{name:/第1問から再開/}).click();
  await expect(page.locator('.question-title')).toContainText('2005年度');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('accepted alternative answer selections have consistent option feedback',async({page})=>{
  await page.addInitScript(k=>{if(!localStorage.getItem(k))localStorage.setItem(k,JSON.stringify({schemaVersion:2,attempts:[],concepts:{},externalRecords:[],settings:{sound:false},session:{id:'variant',questionIds:['2006-19','2006-01','2006-02','2006-03','2006-04'],index:0,selectedIds:[],completed:false}}));},key);
  await page.goto('/');const options=page.getByRole('group',{name:'解答の選択肢'}).getByRole('button');
  await options.nth(2).click();await options.nth(4).click();
  await page.getByRole('button',{name:'答えを確定する'}).click();
  await expect(page.locator('#feedback')).toContainText('正解！');
  await expect(page.locator('#feedback')).toContainText('1・3 または 1・5 または 3・5');
  await expect(options.nth(4)).toHaveClass(/correct/);
  await expect(options.nth(4)).not.toHaveClass(/wrong/);
  await expect(options.nth(0)).toContainText('他の正答の組合せに含まれる');
  await page.reload();await expect(page.locator('#feedback')).toContainText('正解！');
});

test('2018 and 2019 are selectable as text-only sixty-question years',async({page})=>{
  await page.goto('/');
  for(const year of ['2018','2019']){
    await page.getByRole('combobox',{name:'出題する年度'}).selectOption(year);
    await expect(page.getByRole('radio',{name:'全分野（60問）'})).toBeVisible();
    await page.getByRole('button',{name:'5問のクエストを始める'}).click();
    await expect(page.locator('.question-title')).toContainText(`${year}年度`);
    await expect(page.getByRole('button',{name:'原本画像を見る ↗'})).toHaveCount(0);
    await page.getByRole('button',{name:'中断してホーム'}).click();
  }
});
