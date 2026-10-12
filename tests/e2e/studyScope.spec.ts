import { test, expect, type Page } from '@playwright/test';
import catalog from '../../src/data/packs/knowledge.json' with {type:'json'};
import answers from '../../src/data/packs/2025/answers.json' with {type:'json'};

const historyKey = 'care-manager-quest:learning:v3';
async function expectNoOverflow(page: Page) {
  const layout = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth, viewport: innerWidth,
    overflowing: Array.from(document.querySelectorAll('body *')).map(element => {
      const rect = element.getBoundingClientRect();
      return {tag:element.tagName, className:element.className, right:rect.right, width:rect.width};
    }).filter(rect => rect.right > innerWidth + 1),
  }));
  expect(layout.width, JSON.stringify(layout)).toBeLessThanOrEqual(layout.viewport);
}

const categories = catalog.categories;
const concepts = catalog.concepts;
const disease = categories.find(c => c.label === '身体疾患・感染症')!;
function path(id: string) {
  const drawer = concepts.find(c => c.id === id);
  const ids = drawer ? [drawer.id] : [];
  let node = categories.find(c => c.id === (drawer?.categoryId ?? id));
  while (node) {ids.unshift(node.id);const parent = 'parentId' in node ? node.parentId : undefined;node = categories.find(c => c.id === parent);}
  return ids;
}
const currentQuestions = () => Object.entries(catalog.questions).filter(([id]) => id.startsWith('2025-'));
async function selectPath(page: Page, mode: string, id: string) {
  const ids = path(id);
  for (const [i,level] of ['大分類','中分類','小分類','引き出し'].entries()) {
    if (ids[i]) await page.getByLabel(`${mode}の${level}`,{exact:true}).selectOption(ids[i]);
  }
}
const matching = (scope: string) => currentQuestions().filter(([,q]) => q.conceptIds.some(id => path(id).includes(scope))).map(([id]) => id);

test('○× selects a middle category, only draws its cards, restores scope and clears children on parent changes', async ({page}) => {
  await page.goto('/');
  await expect(page.getByLabel('○×の大分類').locator('option')).toHaveCount(6);
  await expect(page.getByLabel('○×の中分類')).toBeDisabled();
  await selectPath(page,'○×',disease.id);
  const drawerIds = concepts.filter(c => path(c.id).includes(disease.id)).map(c => c.id);
  const expected = Object.values(catalog.choices).filter(c => c.drawerIds.some(id => drawerIds.includes(id))).length;
  await expect(page.locator('.swipe-home-stats')).toContainText(`${expected}枚対象`);
  await page.getByRole('button',{name:'○×学習を始める',exact:true}).click();
  for (let i=0;i<3;i++) {
    const meta = await page.locator('.swipe-screen .question-meta').textContent();
    const match = meta!.match(/(\d{4})年度 問(\d+)・選択肢(\d)/)!;
    const key = `${match[1]}-${match[2].padStart(2,'0')}:${match[3]}`;
    const choice = (catalog.choices as Record<string,{drawerIds:string[]}>)[key];
    expect(choice.drawerIds.some(id => path(id).includes(disease.id))).toBe(true);
    await page.getByRole('button',{name:'↑ わからない',exact:true}).click();
    await page.getByRole('button',{name:'次のカードへ',exact:true}).click();
  }
  await page.getByRole('button',{name:'分野選択に戻る'}).click();
  await page.getByLabel('○×の小分類').selectOption({index:1});
  const drawer = page.getByLabel('○×の引き出し');
  const firstEnabled = await drawer.locator('option:not([disabled])').nth(1).getAttribute('value');
  await drawer.selectOption(firstEnabled!);
  await page.reload();
  await expect(drawer).toHaveValue(firstEnabled!);
  await page.getByLabel('○×の中分類').selectOption('all');
  await expect(page.getByLabel('○×の小分類')).toBeDisabled();
  await expect(drawer).toBeDisabled();
  await expect(page.getByLabel('5択の大分類')).toHaveValue('all');
  await expectNoOverflow(page);
});

test('five-choice draws middle-category questions across exam fields and preserves the running quest when filters become empty', async ({page}) => {
  await page.goto('/');
  await selectPath(page,'5択',disease.id);
  const expected = matching(disease.id);
  await expect(page.locator('.mission-note').first()).toContainText(`${expected.length}問対象`);
  await page.getByRole('button',{name:`${Math.min(5,expected.length)}問のクエストを始める`}).click();
  const ids = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).session.questionIds as string[], historyKey);
  expect(ids.every(id => expected.includes(id))).toBe(true);
  await page.getByRole('button',{name:'中断してホーム'}).click();
  // There is at least one available drawer in 2025 but absent in another year.
  const oneYearDrawer = concepts.find(c => currentQuestions().some(([,q]) => q.conceptIds.includes(c.id)) &&
    !Object.entries(catalog.questions).some(([id,q]) => id.startsWith('2005-') && q.conceptIds.includes(c.id)))!;
  await selectPath(page,'5択',oneYearDrawer.id);
  await page.getByLabel('出題する年度').selectOption('2005');
  await expect(page.getByRole('status')).toContainText('該当する問題はありません');
  await expect(page.getByRole('button',{name:'第1問から再開'})).toBeEnabled();
  await page.reload();
  await expect(page.locator('.question-title')).toContainText('2025年度');
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).session.questionIds,historyKey)).toEqual(ids);
});

test('a single-drawer one-question quest completes, reloads and retains its saved selection', async ({page}) => {
  await page.goto('/');
  const drawer = concepts.find(c => matching(c.id).length === 1)!;
  await selectPath(page,'5択',drawer.id);
  await page.getByRole('button',{name:'1問のクエストを始める'}).click();
  await expect(page.locator('.quest-heading')).toContainText('1 / 1');
  const id = matching(drawer.id)[0];
  const key = answers as Record<string,{correctChoices:number[]}>;
  for (const choice of key[id].correctChoices) await page.getByRole('group',{name:'解答の選択肢'}).getByRole('button').nth(choice-1).click();
  await page.getByRole('button',{name:'答えを確定する'}).click();
  await page.reload();
  await page.getByRole('button',{name:'リザルトを見る'}).click();
  await expect(page.getByRole('heading',{name:'完全攻略！'})).toBeVisible();
  await expect(page.locator('.result-score')).toContainText('/ 1');
  await page.reload();
  await expect(page.locator('.result-score')).toContainText('/ 1');
  await page.getByRole('button',{name:'冒険ホームへ'}).click();
  await expect(page.getByLabel('5択の引き出し')).toHaveValue(drawer.id);
  await page.screenshot({path:`test-results/${test.info().project.name}-study-scope.png`,fullPage:true});
  await expectNoOverflow(page);
});

test('unknown saved scopes reset safely to all categories',async ({page}) => {
  await page.addInitScript(() => {
    localStorage.setItem('care-manager-quest:quest-scope','old-missing-id');
    localStorage.setItem('care-manager-quest:swipe-scope','{broken');
  });
  await page.goto('/');
  await expect(page.getByLabel('○×の大分類')).toHaveValue('all');
  await expect(page.getByLabel('5択の大分類')).toHaveValue('all');
  await expect(page.getByRole('button',{name:'5問のクエストを始める'})).toBeEnabled();
});
