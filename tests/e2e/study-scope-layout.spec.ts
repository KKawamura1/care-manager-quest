import { test, expect, type Page } from '@playwright/test';
import catalog from '../../src/data/packs/knowledge.json' with {type:'json'};

async function expectContainedControls(page: Page, stacked: boolean) {
  const layout = await page.locator('.study-scope-picker').evaluateAll(pickers => pickers.map(picker => {
    const bounds = picker.getBoundingClientRect();
    const controls = Array.from(picker.querySelectorAll('select')).map(select => {
      const rect = select.getBoundingClientRect();
      const label = select.parentElement!.getBoundingClientRect();
      return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom,
        height: rect.height, labelLeft: label.left, labelRight: label.right };
    });
    return { left: bounds.left, right: bounds.right, controls };
  }));
  for (const picker of layout) {
    for (const control of picker.controls) {
      expect(control.left).toBeGreaterThanOrEqual(picker.left - 1);
      expect(control.right).toBeLessThanOrEqual(picker.right + 1);
      expect(control.left).toBeGreaterThanOrEqual(control.labelLeft - 1);
      expect(control.right).toBeLessThanOrEqual(control.labelRight + 1);
      expect(control.height).toBeGreaterThanOrEqual(44);
    }
    for (let i = 1; i < picker.controls.length; i++) {
      const previous = picker.controls[i - 1], current = picker.controls[i];
      expect(current.top >= previous.bottom || current.left >= previous.right).toBe(true);
      if (stacked) {
        expect(current.top).toBeGreaterThanOrEqual(previous.bottom);
        expect(current.left).toBeCloseTo(previous.left, 0);
      }
    }
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(await page.evaluate(() => innerWidth));
}

for (const width of [320, 393, 430, 560]) {
  test(`selectors stay inside their own columns at ${width}px, including long labels`, async ({page}) => {
    await page.setViewportSize({ width, height: 852 });
    await page.goto('/');
    await expectContainedControls(page, width <= 480);
    // Check the selected longest drawer as well as the initial disabled placeholders.
    const drawer = [...catalog.concepts].sort((a,b) => b.label.length - a.label.length)[0];
    const ids = [drawer.id];
    let node = catalog.categories.find(c => c.id === drawer.categoryId);
    while (node) {
      ids.unshift(node.id);
      node = catalog.categories.find(c => c.id === ('parentId' in node! ? node!.parentId : undefined));
    }
    await page.getByLabel('出題する年度', {exact:true}).selectOption('all');
    for (const mode of ['○×', '5択']) {
      for (const [i,level] of ['大分類','中分類','小分類','引き出し'].entries()) {
        await page.getByLabel(`${mode}の${level}`, {exact:true}).selectOption(ids[i]);
      }
    }
    await expectContainedControls(page, width <= 480);
    await page.getByLabel('○×の大分類', {exact:true}).focus();
    await page.screenshot({path: `test-results/${test.info().project.name}-${width}-scope-layout.png`, fullPage: true});
  });
}
