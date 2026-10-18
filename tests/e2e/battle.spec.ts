import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
const keys=JSON.parse(readFileSync(new URL('../../src/data/packs/2025/answers.json',import.meta.url),'utf8'));
const storageKey='care-manager-quest:battle:v1';
test('mobile battle: accuracy, result, review, rematch and isolated history',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');
  const before=await page.evaluate(()=>localStorage.getItem('care-manager-quest:learning:v3'));
  await page.getByRole('button',{name:'対戦へ',exact:true}).click();
  await page.getByRole('button',{name:'対戦を始める',exact:true}).click();
  await expect(page.getByRole('button',{name:'解答して次へ'})).toBeDisabled();
  const record=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!)[0],storageKey);
  expect(record.questionIds).toHaveLength(10);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`test-results/${test.info().project.name}-battle.png`,fullPage:true});
  for(let i=0;i<10;i++) {
    const id=record.questionIds[i];
    const correct:number[]=keys[id].correctChoices;
    const choices=i===0?[...correct.slice(1),[1,2,3,4,5].find(n=>!correct.includes(n))!]:correct;
    const buttons=page.getByRole('group',{name:'対戦の選択肢'}).getByRole('button');
    for(const n of choices)await buttons.nth(n-1).click();
    await page.getByRole('button',{name:'解答して次へ'}).click();
    if(i<9)await expect(buttons.first()).toBeEnabled();
  }
  await expect(page.getByRole('heading',{name:'あなたの勝利！'})).toBeVisible();
  await expect(page.getByText('9 / 10 正解',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'間違えた1問を確認'}).click();
  await expect(page.locator('.battle-review article')).toHaveCount(1);
  await expect(page.locator('.battle-review .answer-key')).toContainText('あなた：');
  await page.screenshot({path:`test-results/${test.info().project.name}-battle-result.png`,fullPage:true});
  await page.getByRole('button',{name:'もう一戦',exact:true}).click();
  const records=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!),storageKey);
  expect(records).toHaveLength(2);expect(records[0].completed).toBe(true);expect(records[1].chain).toBe(2);
  expect(records[1].questionIds.some((id:string)=>record.questionIds.includes(id))).toBe(false);
  expect(await page.evaluate(()=>localStorage.getItem('care-manager-quest:learning:v3'))).toBe(before);
  expect(errors).toEqual([]);
});

test('clock includes time away and ghost advances without player answers',async({page})=>{
  await page.clock.install();
  await page.goto('/');
  await page.getByRole('button',{name:'対戦へ',exact:true}).click();
  await page.getByRole('button',{name:'対戦を始める',exact:true}).click();
  await page.clock.fastForward(60000);
  await expect(page.getByLabel('対戦の進捗')).toContainText('2 / 10問');
  await expect(page.locator('.battle-clock')).toContainText('60.');
  await page.getByRole('button',{name:'‹ ホーム',exact:true}).click();
  await page.reload();
  await page.getByRole('button',{name:'対戦へ',exact:true}).click();
  await expect(page.getByRole('button',{name:'対戦を始める'})).toBeVisible();
});
