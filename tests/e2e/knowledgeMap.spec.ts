import { test, expect } from '@playwright/test';

test('shows root, middle, small concept and attribute as four navigable levels', async ({page}) => {
  await page.goto('/');
  await page.getByRole('button',{name:'知識マップ',exact:true}).click();
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
  const middle=page.locator('.knowledge-middle').filter({has:page.getByText('保険料・財政',{exact:true})});
  await middle.locator(':scope > summary').click();
  const small=middle.locator('.knowledge-small').filter({has:page.getByText('第1号被保険者保険料',{exact:true})});
  await small.locator(':scope > summary').click();
  await small.getByRole('button').first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog')).toContainText('第1号被保険者保険料');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});
