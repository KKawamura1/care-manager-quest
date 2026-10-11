import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const key = 'care-manager-quest:learning:v3';
const truth = JSON.parse(readFileSync(new URL('../../data/choice-tf/choice-answers-2005-2025.json', import.meta.url), 'utf8')).questions;
const ledger = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!).learningEvents as {
  cardId:string;answer:boolean|null;xp:number;mode:string;at:string;
}[], key);
const start = (page: Page) => page.getByRole('button', { name: '○×学習を始める', exact: true }).click();
async function currentTruth(page: Page) {
  const meta = await page.locator('.swipe-screen .question-meta').textContent();
  const match = meta!.match(/(\d{4})年度 問(\d+)・選択肢(\d)/)!;
  return truth[`${match[1]}-${match[2].padStart(2,'0')}`].choiceAnswers[Number(match[3])-1] === '○';
}
async function drag(page: Page, dx: number, dy = 0, feedback = false) {
  const target = feedback ? page.locator('#swipe-feedback') : page.getByRole('group',{name:'○×カード',exact:true});
  await target.scrollIntoViewIfNeeded();
  const box = (await target.boundingBox())!;
  const x=box.x+box.width/2,y=box.y+box.height/2;
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+dx,y+dy,{steps:8});await page.mouse.up();
}

test('○× is available on home with year/category filters', async ({page})=>{
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'5択クエスト',exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:'○×学習',exact:true})).toBeVisible();
  await page.getByLabel('○×の年度').selectOption('2020');
  await start(page);
  await expect(page.locator('.question-meta')).toContainText('2020年度');
  await page.getByRole('button',{name:'分野選択に戻る'}).click();
  await expect(page.getByLabel('○×の年度')).toHaveValue('2020');
});

test('swipe answer earns XP and populates unified history and map; reload persists',async({page})=>{
  await page.goto('/');
  await start(page);
  const truth = await currentTruth(page);
  await page.getByRole('button',{name:truth?'○と答える':'×と答える',exact:true}).click();
  await expect(page.locator('.swipe-verdict')).toBeVisible();
  await expect(page.locator('.feedback')).toContainText('+10 XP');
  await expect.poll(async()=> (await ledger(page)).length).toBe(1);
  const events=await ledger(page);
  expect(events[0]).toMatchObject({mode:'swipe',xp:10});
  await page.reload();
  expect((await ledger(page))[0]).toEqual(events[0]);
  await page.getByRole('button',{name:'知識マップ',exact:true}).click();
  await expect(page.locator('.map-summary')).not.toContainText('0 / 1159');
  await page.getByRole('button',{name:'記録',exact:true}).click();
  await expect(page.locator('.record-stats')).toContainText('10');
});

test('five-choice converts into five daily choice events and shares XP with ○×',async({page})=>{
  await page.goto('/');
  await page.getByRole('button',{name:'5問のクエストを始める'}).click();
  const instructions=await page.locator('.selection-instruction b').textContent();
  const count=Number(instructions!.match(/\d/)![0]);
  for(let i=0;i<count;i++)await page.getByRole('group',{name:'解答の選択肢'}).getByRole('button').nth(i).click();
  await page.getByRole('button',{name:'答えを確定する'}).click();
  const events=await ledger(page);
  expect(events).toHaveLength(5);
  expect(events.every(e=>e.mode==='five-choice')).toBe(true);
  const xp=events.reduce((sum,e)=>sum+e.xp,0);
  expect(xp).toBeGreaterThan(0);
  await page.getByRole('button',{name:'○×学習',exact:true}).click();
  await start(page);
  await page.getByRole('button',{name:'↑ わからない',exact:true}).click();
  expect((await ledger(page))).toHaveLength(6);
});

test('short gesture does not answer; arrow keys and second swipe advance',async({page})=>{
  await page.goto('/'); await start(page);
  await drag(page,15);
  expect(await ledger(page)).toHaveLength(0);
  await page.getByRole('group',{name:'○×カード',exact:true}).press('ArrowUp');
  await expect(page.locator('.swipe-verdict')).toContainText('あなた：わからない');
  const firstMeta=await page.locator('.question-meta').textContent();
  await drag(page,90,0,true);
  await expect(page.locator('.question-meta')).not.toHaveText(firstMeta!);
  expect(await ledger(page)).toHaveLength(1);
});

test('broken unified history cannot be silently overwritten',async({page})=>{
  await page.addInitScript(key=>localStorage.setItem(key,'{broken'),key);
  await page.goto('/');
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('button',{name:'○×学習を始める'})).toBeDisabled();
  expect(await page.evaluate(key=>localStorage.getItem(key),key)).toBe('{broken');
  await page.getByRole('button',{name:'新しい履歴で始める'}).click();
  await expect(page.getByRole('button',{name:'○×学習を始める'})).toBeEnabled();
});

test('native mobile touch swipes still answer',async({page,browserName})=>{
  test.skip(browserName!=='chromium','CDP touch events require chromium');
  await page.goto('/');await start(page);
  const card=page.getByRole('group',{name:'○×カード',exact:true});
  await card.scrollIntoViewIfNeeded();
  const rect=(await card.boundingBox())!,x=rect.x+rect.width/2,y=rect.y+rect.height/2;
  const client=await page.context().newCDPSession(page);
  await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
  for(let dx=15;dx<=90;dx+=15)await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx,y}]});
  await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await expect(page.locator('.swipe-verdict')).toContainText('あなた：○');
});

test('repeating a card on the same day is available but does not grant XP twice',async({page})=>{
  await page.goto('/');await start(page);
  const correct=await currentTruth(page);
  await page.getByRole('button',{name:correct?'○と答える':'×と答える',exact:true}).click();
  expect((await ledger(page))[0].xp).toBe(10);
  await page.getByRole('button',{name:'同じカードを再練習（XPなし）'}).click();
  await page.getByRole('button',{name:correct?'×と答える':'○と答える',exact:true}).click();
  const events=await ledger(page);
  expect(events).toHaveLength(2);
  expect(events[1].xp).toBe(0);
  expect(events[0].xp).toBe(10);
  await expect(page.locator('.feedback')).toContainText('+0 XP');
});
