import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { Question } from '../../src/domain/models';
const raw = JSON.parse(readFileSync(new URL('../../src/data/packs/2025/questions.json', import.meta.url), 'utf8'));
const answers=JSON.parse(readFileSync(new URL('../../src/data/packs/2025/answers.json', import.meta.url), 'utf8'));
const questions=raw.map((q:{id:string;choices:string[]})=>({id:q.id,answerIds:answers[q.id].correctChoices.map(String),selectionCount:answers[q.id].selectionCount,options:q.choices.map((text:string,i:number)=>({id:String(i+1),text}))})) as Question[];
const key='care-manager-quest:v1';
async function chooseAnswer(page: import('@playwright/test').Page, wrong=false) {
 const p=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!),key);
 const q=questions.find(q=>q.id===p.session.questionIds[p.session.index])!;
 const ids=wrong?[...q.answerIds.slice(1),q.options.find(o=>!q.answerIds.includes(o.id))!.id]:q.answerIds;
 for(const id of ids)await page.getByRole('group',{name:'解答の選択肢'}).getByRole('button').nth(Number(id)-1).click();
 await page.getByRole('button',{name:'答えを確定する'}).click();
 return q;
}
test('five questions, feedback, deep dive, persistence, result and knowledge map',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await expect(page.getByRole('heading',{name:'推理が、 知識に変わる。'})).toBeVisible();
 await page.screenshot({path:`test-results/${test.info().project.name}-home.png`,fullPage:false});
 await page.getByRole('button',{name:'5問のクエストを始める'}).click();await expect(page.getByRole('button',{name:/あと.*選んでください/})).toBeDisabled();
 const first=await chooseAnswer(page);await expect(page.getByText('✦ 初見突破 +20')).toBeVisible();
  await expect(page.locator('#feedback > p').first()).toBeInViewport();
  await page.screenshot({path:`test-results/${test.info().project.name}-feedback-viewport.png`});await page.screenshot({path:`test-results/${test.info().project.name}-feedback.png`,fullPage:true});
 await page.getByRole('button',{name:'詳しく見る'}).click();await expect(page.getByRole('dialog')).toBeVisible();await page.getByRole('button',{name:'理解を記録する',exact:true}).click();await page.getByRole('dialog').locator('.related-list button').first().click();await expect(page.getByRole('dialog').locator('.status-pill')).toBeVisible();await page.getByRole('button',{name:'閉じる'}).click();await expect(page.getByRole('dialog')).toContainText('2025年度試験当時の正答');await page.getByRole('button',{name:'元の画面へ戻る'}).click();
 await expect(page.locator('.question-title')).toContainText(`問${Number(first.id.split('-')[1])}｜`);await page.reload();await expect(page.getByRole('button',{name:'次の問題へ'})).toBeVisible();
 const before=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!).attempts.length,key);expect(before).toBe(1);
 for(let i=1;i<5;i++){await page.getByRole('button',{name:'次の問題へ'}).click();await chooseAnswer(page,i===2);}
 await page.getByRole('button',{name:'リザルトを見る'}).click();await expect(page.getByText('探索、おつかれさま。', {exact:true})).toBeVisible();await page.screenshot({path:`test-results/${test.info().project.name}-result.png`,fullPage:true});
 await page.getByRole('button',{name:'広がった知識マップを見る'}).click();await expect(page.getByRole('heading',{name:'知識マップ',exact:true})).toBeVisible();await page.screenshot({path:`test-results/${test.info().project.name}-map.png`,fullPage:true});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
});
test('selection limit, pause and reload before answering',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'5問のクエストを始める'}).click();const options=page.getByRole('group',{name:'解答の選択肢'}).getByRole('button');await options.nth(0).click();await options.nth(1).click();
 const count=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!).session.selectedIds.length,key);await options.nth(4).click();const after=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!).session.selectedIds.length,key);expect(after).toBeLessThanOrEqual(3);expect(after).toBeGreaterThanOrEqual(count);
 await page.getByRole('button',{name:'中断してホーム'}).click();await page.getByRole('button',{name:/第1問から再開/}).click();await page.reload();await expect(options.nth(0)).toHaveAttribute('aria-pressed','true');
});
test('JSON export/import is staged; invalid imports leave history intact; external record persists',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'5問のクエストを始める'}).click();await chooseAnswer(page);await page.getByRole('button',{name:'記録',exact:true}).click();
 const original=await page.evaluate(k=>localStorage.getItem(k)!,key);const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'JSONを書き出す'}).click();expect((await downloadPromise).suggestedFilename()).toBe('care-manager-quest-history.json');
 await page.locator('input[type=file]').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{}')});await expect(page.getByRole('status')).toContainText('形式が不正');expect(await page.evaluate(k=>localStorage.getItem(k),key)).toBe(original);
 await page.locator('input[type=file]').setInputFiles({name:'history.json',mimeType:'application/json',buffer:Buffer.from(original)});await expect(page.getByRole('dialog')).toContainText('1件');await page.getByRole('button',{name:'読み込んで置き換える'}).click();await expect(page.getByRole('button',{name:'次の問題へ'})).toBeVisible();
 await page.getByRole('button',{name:'記録',exact:true}).click();await page.getByLabel('問題の固定URL').fill('https://keamane.kakomonn.com/questions/12345');await page.getByLabel('表示名（任意）').fill('外部テスト');await page.getByRole('button',{name:'結果を記録する'}).click();await page.reload();await page.getByRole('button',{name:'記録',exact:true}).click();await expect(page.getByRole('link',{name:'外部テスト ↗'})).toBeVisible();
});
test('corrupt stored data remains intact until explicit recovery',async({page})=>{
 await page.addInitScript(k=>localStorage.setItem(k,'{broken'),key);await page.goto('/');await expect(page.getByRole('alert')).toBeVisible();expect(await page.evaluate(k=>localStorage.getItem(k),key)).toBe('{broken');await expect(page.getByRole('button',{name:'5問のクエストを始める'})).toBeDisabled();await page.getByRole('button',{name:'新しい履歴で始める'}).click();await expect(page.getByRole('button',{name:'5問のクエストを始める'})).toBeEnabled();
});

test('all 25 official questions play across five quests, each original image maps to the same number',async({page})=>{
 test.setTimeout(120_000);await page.goto('/');await page.getByRole('button',{name:'5問のクエストを始める'}).click();
 const seen:string[]=[];
 for(let session=0;session<5;session++){
  for(let index=0;index<5;index++){
   const id=await page.evaluate(k=>{const p=JSON.parse(localStorage.getItem(k)!);return p.session.questionIds[p.session.index] as string},key);seen.push(id);
   await expect(page.locator('.question-title')).toContainText(`問${Number(id.split('-')[1])}｜`);
   if(['2025-24','2025-25'].includes(id)){
    await expect(page.locator('.question-stem')).not.toBeEmpty();
    await expect(page.getByRole('group',{name:'解答の選択肢'}).getByRole('button').first()).not.toContainText('選択肢 1');
   }
   await page.getByRole('button',{name:'原本画像を見る ↗'}).click();const img=page.getByRole('dialog').locator('img');
   await expect(img).toHaveAttribute('src',`/assets/questions/2025/q${id.split('-')[1]}.png`);await expect(img).toBeVisible();
   expect(await img.evaluate((e:HTMLImageElement)=>e.complete&&e.naturalWidth>0)).toBe(true);
   await page.getByRole('button',{name:'元の画面へ戻る'}).click();await chooseAnswer(page);
   await expect(page.locator('#feedback')).toContainText('独自解説はまだ登録されていません');
   if(index<4)await page.getByRole('button',{name:'次の問題へ'}).click();
  }
  await page.getByRole('button',{name:'リザルトを見る'}).click();await expect(page.getByText('完全攻略！',{exact:true})).toBeVisible();
  if(session<4)await page.getByRole('button',{name:'もう5問、探索する'}).click();
 }
 expect(new Set(seen).size).toBe(25);expect(seen.every(id=>id.startsWith('2025-'))).toBe(true);
 expect(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!).attempts.every((a:{correct:boolean})=>a.correct),key)).toBe(true);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('existing schema 1 history is backed up and retained while old questions leave the active pool',async({page})=>{
 const legacy=JSON.parse(readFileSync(new URL('../../src/data/legacy-questions.json',import.meta.url),'utf8')) as Question[];
 const q=legacy[0];const concepts=Object.fromEntries(q.conceptIds.map(id=>[id,{seenQuestionIds:[q.id],correctQuestionIds:[q.id],reflected:true}]));
 const old={schemaVersion:1,attempts:[{id:'legacy:0',sessionId:'legacy',questionId:q.id,questionVersion:q.version,selectedIds:q.answerIds,correct:true,firstSeen:true,combo:1,xp:60,at:'2026-10-10T10:00:00.000Z'}],concepts,session:{id:'legacy',questionIds:legacy.slice(0,5).map(q=>q.id),index:0,selectedIds:q.answerIds,completed:false},externalRecords:[],settings:{sound:false}};
 await page.addInitScript(({key,old})=>{localStorage.setItem(key,JSON.stringify(old))},{key,old});await page.goto('/');await expect(page.getByRole('status')).toContainText('以前の履歴・XPを引き継ぎました');
 expect(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!).schemaVersion,key)).toBe(2);
 expect(await page.evaluate(k=>JSON.parse(localStorage.getItem(k+':before-official')!).attempts[0].questionId,key)).toBe(q.id);
 await page.getByRole('button',{name:'5問のクエストを始める'}).click();expect(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!).session.questionIds.every((id:string)=>id.startsWith('2025-')),key)).toBe(true);
 await page.getByRole('button',{name:'記録',exact:true}).click();await expect(page.locator('.record-stats')).toContainText('60');
});


test('domain setting offers all 60 as text while preserving the existing history',async({page})=>{
 await page.goto('/');
 await expect(page.getByText('2020〜2025年度・全360問の公式過去問。年度と分野を選んで5問ずつ挑戦できます。')).toBeVisible();
 await page.getByRole('radio',{name:'保健医療（20問）'}).check();
 await page.getByRole('button',{name:'5問のクエストを始める'}).click();
 let id=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!).session.questionIds[0],key);
 expect(Number(id.split('-')[1])).toBeGreaterThanOrEqual(26);
 expect(Number(id.split('-')[1])).toBeLessThanOrEqual(45);
 await expect(page.locator('.question-stem')).not.toBeEmpty();
 await expect(page.getByRole('group',{name:'解答の選択肢'}).getByRole('button')).toHaveCount(5);
 const firstOptionWidth=(await page.getByRole('group',{name:'解答の選択肢'}).getByRole('button').first().boundingBox())?.width;
 expect(firstOptionWidth).toBeGreaterThan(230);
 await chooseAnswer(page);
 await page.getByRole('button',{name:'中断してホーム'}).click();
 await page.getByRole('radio',{name:'福祉（15問）'}).check();
 await expect(page.getByRole('button',{name:/第1問から再開/})).toBeVisible();
 await page.reload();
 // An in-progress session opens straight in play after reload; go home to inspect the persisted domain setting.
 await page.getByRole('button',{name:'中断してホーム'}).click();
 await expect(page.getByRole('radio',{name:'福祉（15問）'})).toBeChecked();
 await page.getByRole('button',{name:/第1問から再開/}).click();
 await expect(page.locator('.question-title')).toContainText('問'+Number(id.split('-')[1]));
});
