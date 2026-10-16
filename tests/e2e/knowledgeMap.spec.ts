import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

test('first correct answer visibly fills drawers and their ancestors and survives reload', async ({page}) => {
  const truth = JSON.parse(readFileSync(new URL('../../data/choice-tf/choice-answers-2005-2025.json', import.meta.url), 'utf8')).questions;
  await page.setViewportSize({width:320,height:720});
  await page.goto('/');
  await page.getByRole('button', {name:'記録', exact:true}).click();
  await page.getByRole('link', {name:'知識マップ', exact:true}).click();
  const mainMenu = page.getByRole('navigation',{name:'メインメニュー'});
  await expect(mainMenu.getByRole('button')).toHaveCount(4);
  for (const name of ['冒険', '○×学習', '過去問演習', '記録']) {
    await expect(mainMenu.getByRole('button',{name,exact:true})).toBeVisible();
  }
  await expect(page.getByRole('region',{name:'日々の積み上げ'})).toHaveCount(1);
  await expect(page.getByRole('region',{name:'分野別の得意・苦手'})).toHaveCount(1);
  await expect(page.getByRole('heading',{name:'履歴を持ち出す',exact:true})).toHaveCount(1);
  expect(await page.getByRole('progressbar', {name:'全体の学習レベル', exact:true}).getAttribute('aria-valuenow')).toBe('0');
  await page.getByRole('button', {name:'冒険', exact:true}).click();
  await page.getByRole('button', {name:'○×学習を始める', exact:true}).click();
  const meta = (await page.locator('.swipe-screen .question-meta').textContent())!.match(/(\d{4})年度 問(\d+)・選択肢(\d)/)!;
  const correct = truth[`${meta[1]}-${meta[2].padStart(2,'0')}`].choiceAnswers[Number(meta[3])-1] === '○';
  await page.getByRole('button', {name: correct ? '○と答える' : '×と答える', exact:true}).click();
  await expect(page.locator('.swipe-verdict')).toBeVisible();
  await page.getByRole('button', {name:'記録', exact:true}).click();
  await page.getByRole('link', {name:'知識マップ', exact:true}).click();
  const global = page.getByRole('progressbar', {name:'全体の学習レベル', exact:true});
  const value = Number(await global.getAttribute('aria-valuenow'));
  expect(value).toBeGreaterThan(0);
  await expect(global).toHaveAttribute('aria-valuetext', '0.1%未満');
  const filled = page.locator('.map-region [role=progressbar]').filter({has:page.locator('span[style*="min-width: 2px"]')});
  // The one answered card reaches all four hierarchy levels.
  expect(await filled.count()).toBeGreaterThanOrEqual(4);
  const drawer = page.locator('.concept-node.learning').first();
  await drawer.evaluate(node => {
    for (let ancestor = node.parentElement; ancestor; ancestor = ancestor.parentElement) {
      if (ancestor instanceof HTMLDetailsElement) ancestor.open = true;
    }
  });
  await expect(drawer.getByRole('progressbar')).toBeVisible();
  expect(Number(await drawer.getByRole('progressbar').getAttribute('aria-valuenow'))).toBeGreaterThan(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.reload();
  await page.getByRole('button', {name:'記録', exact:true}).click();
  await page.getByRole('link', {name:'知識マップ', exact:true}).click();
  expect(Number(await global.getAttribute('aria-valuenow'))).toBe(value);
});

test('shows root, middle, small concept and attribute as four navigable levels', async ({page}) => {
  await page.goto('/');
  await page.getByRole('button',{name:'記録',exact:true}).click();
  await page.getByRole('link',{name:'知識マップ',exact:true}).click();
  await expect(page.locator('.map-region')).toHaveCount(5);
  await expect(page.locator('.knowledge-middle')).toHaveCount(28);
  await expect(page.getByRole('heading',{name:'介護保険制度',exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:'高齢者福祉',exact:true})).toBeVisible();
  const administration=page.locator('.knowledge-middle').filter({has:page.getByText('行政運営・指定監督',{exact:true})});
  await administration.locator(':scope > summary').click();
  const federation=administration.locator('.knowledge-small').filter({has:page.getByText('国保連の組織・法定業務',{exact:true})});
  await federation.locator(':scope > summary').click();
  await expect(federation.getByRole('button',{name:/第三者行為求償事務/})).toBeVisible();
  await expect(administration.locator('.knowledge-small').filter({has:page.getByText('介護給付費の審査・支払',{exact:true})})).toHaveCount(1);
  await expect(administration.locator('.knowledge-small').filter({has:page.getByText('介護サービスの苦情処理制度',{exact:true})})).toHaveCount(1);
  const community=page.locator('.knowledge-middle').filter({has:page.getByText('地域支援事業・事業計画',{exact:true})});
  await community.locator(':scope > summary').click();
  const legacy=community.locator('.knowledge-small').filter({has:page.getByText('旧介護予防事業（特定高齢者・一次／二次予防）',{exact:true})});
  await legacy.locator(':scope > summary').click();
  await legacy.getByRole('button',{name:/対象・要件/}).click();
  await expect(page.getByRole('dialog')).toContainText('旧介護予防事業（特定高齢者・一次／二次予防）');
  await page.getByRole('dialog').getByRole('button',{name:'閉じる',exact:true}).click();
  await expect(community.locator('.knowledge-small').filter({has:page.getByText('一般介護予防事業',{exact:true})})).toHaveCount(1);
  await expect(community.locator('.knowledge-small').filter({has:page.getByText('介護保険法の保健福祉事業',{exact:true})})).toHaveCount(1);
  const middle=page.locator('.knowledge-middle').filter({has:page.getByText('保険料・財政',{exact:true})});
  await middle.locator(':scope > summary').click();
  const small=middle.locator('.knowledge-small').filter({has:page.getByText('第1号被保険者保険料',{exact:true})});
  await small.locator(':scope > summary').click();
  await small.getByRole('button').first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog')).toContainText('第1号被保険者保険料');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});
