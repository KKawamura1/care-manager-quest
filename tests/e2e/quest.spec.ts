import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { Question } from '../../src/domain/models';
const questions = JSON.parse(readFileSync(new URL('../../src/data/questions.json', import.meta.url), 'utf8')) as Question[];
const key='care-manager-quest:v1';
async function chooseAnswer(page: import('@playwright/test').Page, wrong=false) {
 const p=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!),key);
 const q=questions.find(q=>q.id===p.session.questionIds[p.session.index])!;
 const ids=wrong?q.options.filter(o=>!q.answerIds.includes(o.id)).slice(0,q.selectionCount).map(o=>o.id):q.answerIds;
 for(const id of ids)await page.getByRole('group',{name:'解答の選択肢'}).getByRole('button').nth(Number(id)-1).click();
 await page.getByRole('button',{name:'答えを確定する'}).click();
 return q;
}
test('five questions, feedback, deep dive, persistence, result and knowledge map',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await expect(page.getByRole('heading',{name:'推理が、 知識に変わる。'})).toBeVisible();
 await page.screenshot({path:`test-results/${test.info().project.name}-home.png`,fullPage:false});
 await page.getByRole('button',{name:'5問のクエストを始める'}).click();await expect(page.getByRole('button',{name:/あと.*選んでください/})).toBeDisabled();
 const first=await chooseAnswer(page);await expect(page.getByText('✦ 初見突破 +20')).toBeVisible();await page.screenshot({path:`test-results/${test.info().project.name}-feedback.png`,fullPage:true});
 await page.getByRole('button',{name:'詳しく理解する'}).click();await expect(page.getByRole('dialog')).toBeVisible();await page.getByRole('button',{name:'理解を記録する',exact:true}).click();await page.getByRole('button',{name:'元の画面へ戻る'}).click();
 await expect(page.getByRole('heading',{name:first.title,exact:true})).toBeVisible();await page.reload();await expect(page.getByRole('button',{name:'次の問題へ'})).toBeVisible();
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
