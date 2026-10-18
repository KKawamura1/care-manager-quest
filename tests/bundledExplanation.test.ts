import { describe, expect, it } from 'vitest';
import { questions, questionById } from '../src/data/provider';
import { bundledExplanations, explanationFor } from '../src/data/bundled-explanations';
import { swipeCards } from '../src/data/swipe-provider';
import { matchesExplanation } from '../src/domain/bundledExplanation';

describe('bundled original explanations', () => {
  it('covers all 60 current 2025 questions and 300 independently keyed choices', () => {
    const pool = questions.filter(q => q.original?.year === 2025);
    expect(pool).toHaveLength(60);
    expect(bundledExplanations).toHaveLength(60);
    expect(new Set(bundledExplanations.map(e => `${e.year}-${e.number}`)).size).toBe(60);
    expect(bundledExplanations.reduce((n,e) => n + e.choices.length,0)).toBe(300);
    for (const q of pool) {
      const entry = explanationFor(q)!;
      expect(entry, q.id).toBeDefined();
      expect(entry.overview.length).toBeGreaterThan(30);
      expect(entry.basis).toContain('2025年度');
      expect(entry.sources.length).toBeGreaterThan(0);
      for (const s of entry.sources) expect(new URL(s.url).protocol).toBe('https:');
      for (const c of entry.choices) {
        const card = swipeCards.find(card => card.questionId === q.id && card.choiceId === c.id)!;
        expect(card, `${q.id}:${c.id}`).toBeDefined();
        expect(c.truth).toBe(card.truth);
        expect(c.explanation.length).toBeGreaterThanOrEqual(60);
        expect(c.explanation.length).toBeLessThanOrEqual(180);
      }
    }
  });

  it('fails closed for changed wording, answers, versions, identities and choice order', () => {
    const q = questionById('2025-04')!;
    const entry = explanationFor(q)!;
    expect(matchesExplanation(q, entry)).toBe(true);
    for (const changed of [
      { ...q, stem: q.stem + '修正' },
      { ...q, version: q.version + 1 },
      { ...q, answerIds: ['1','2','3'] },
      { ...q, answerVariants: [q.answerIds, ['1','2','3']] },
      { ...q, options: q.options.map((o,i) => i ? o : { ...o, text: '改訂した選択肢' }) },
      { ...q, options: q.options.slice().reverse() },
      { ...q, original: { ...q.original!, year: 2024 } },
      { ...q, original: undefined },
    ]) expect(matchesExplanation(changed,entry)).toBe(false);
    expect(explanationFor(undefined)).toBeUndefined();
    expect(explanationFor(questions.find(q => q.original?.year === 2020))).toBeUndefined();
  });
});
