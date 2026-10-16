import { describe, expect, it } from 'vitest';
import { glossaryTerms } from '../src/data/glossary';
import { splitGlossaryText } from '../src/domain/glossary';
import { swipeCards } from '../src/data/swipe-provider';

const split = (text: string) => splitGlossaryText(text, glossaryTerms);
describe('inline glossary', () => {
  it('preserves every character of the exam corpus and leaves unknown words alone', () => {
    for (const card of swipeCards) {
      for (const text of [card.stem, card.text]) expect(split(text).map(part => part.text).join('')).toBe(text);
    }
    expect(split('未登録の用語です。')).toEqual([{text:'未登録の用語です。'}]);
    expect(split('')).toEqual([]);
  });
  it('prioritizes complete service names over shorter nested terms', () => {
    const text = '介護予防認知症対応型共同生活介護と看護小規模多機能型居宅介護、介護保険審査会と介護認定審査会、介護予防ケアマネジメントとケアマネジメント';
    expect(split(text).flatMap(part => part.term ? [part.term.label] : [])).toEqual([
      '介護予防認知症対応型共同生活介護', '看護小規模多機能型居宅介護', '介護保険審査会', '介護認定審査会',
      '介護予防ケアマネジメント', 'ケアマネジメント',
    ]);
  });
  it('recognizes aliases, full-width acronyms, OCR spacing and repeated terms without rewriting', () => {
    const text = 'ＡＤＬとＩＡＤＬ、介護老人 保健施設、老健、老健';
    const parts = split(text);
    expect(parts.map(part => part.text).join('')).toBe(text);
    expect(parts.flatMap(part => part.term ? [part.term.label] : [])).toEqual([
      '日常生活動作', '手段的日常生活動作', '介護老人保健施設', '介護老人保健施設', '介護老人保健施設',
    ]);
    expect(split('BADL IADLX').some(part => part.term)).toBe(false);
  });
  it('has unambiguous lookup names and source-backed definitions', () => {
    const names = glossaryTerms.flatMap(term => [term.label, ...(term.aliases ?? [])]);
    expect(new Set(names).size).toBe(names.length);
    expect(new Set(glossaryTerms.map(term => term.id)).size).toBe(glossaryTerms.length);
    for (const term of glossaryTerms) {
      expect(term.description.length).toBeGreaterThan(10);
      expect(new URL(term.sourceUrl).protocol).toBe('https:');
    }
  });
});
