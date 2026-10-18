import { describe, expect, it } from 'vitest';
import { cardTarget, explanationStorageKey, parseAppExplanation, questionTarget } from '../src/domain/appExplanation';
import { questionCopyText, swipeCopyText } from '../src/domain/questionCopy';
import { questionById, questions } from '../src/data/provider';
import { swipeCards } from '../src/data/swipe-provider';

describe('ChatGPT short explanations', () => {
  const card = swipeCards.find(c => c.year === 2020)!;
  const question = questionById(card.questionId)!;
  const target = cardTarget(card);
  const payload = { schemaVersion: 1, ...target, explanation: '  誤りの理由と覚えるポイント。  ' };
  it('accepts both a copied JSON code block and its contents, trimming explanation text', () => {
    for (const text of [JSON.stringify(payload), '```json\n' + JSON.stringify(payload) + '\n```']) {
      expect(parseAppExplanation(text, target)).toEqual({ ...payload, explanation: payload.explanation.trim() });
    }
    const qTarget = questionTarget(question);
    expect(parseAppExplanation(JSON.stringify({ schemaVersion: 1, ...qTarget, explanation: '問題全体の解説' }), qTarget).explanation).toBe('問題全体の解説');
  });
  it('rejects a different problem, choice, revision or scope without guessing identity', () => {
    for (const patch of [{ questionId: '2025-01' }, { questionVersion: question.version + 1 }, { choiceId: '9' }, { cardRevision: 'old' }, { schemaVersion: 2 }]) {
      expect(() => parseAppExplanation(JSON.stringify({ ...payload, ...patch }), target)).toThrow();
    }
    expect(() => parseAppExplanation(JSON.stringify(payload), questionTarget(question))).toThrow();
    expect(explanationStorageKey(target)).not.toBe(explanationStorageKey(questionTarget(question)));
    expect(explanationStorageKey(target)).not.toBe(explanationStorageKey({ ...target, choiceId: '9' }));
  });
  it('rejects empty, long, malformed or full conversational responses', () => {
    for (const explanation of ['', '  ', 'あ'.repeat(601), 12, null]) expect(() => parseAppExplanation(JSON.stringify({ ...payload, explanation }), target)).toThrow();
    for (const text of ['null', '[]', '詳しい説明\n```json\n' + JSON.stringify(payload) + '\n```', '{bad', 'a'.repeat(16_001)]) expect(() => parseAppExplanation(text, target)).toThrow();
  });
  it('requests separately copyable short explanations for every normal question', () => {
    for (const q of questions) {
      const text = questionCopyText(q);
      expect(text).toContain('docs/register-explanation.md');
      expect(text).toContain('PRと追加承認の省略');
      const json = text.match(/```json\n([\s\S]*?)\n```/)![1];
      expect(parseAppExplanation(json, questionTarget(q)).questionId).toBe(q.id);
    }
  });
  it('retains source context, old 2020 IDs, answer polarity and the learner answer in a focused swipe prompt', () => {
    const before = swipeCopyText(question, card);
    expect(before).toContain(card.text); expect(before).toContain(question.stem);
    expect(before).toContain(`"questionId": "${question.id}"`);
    expect(before).not.toContain('【このカードの試験当時の判定】');
    expect(before).not.toContain('【自分の○×解答】');
    expect(before).not.toContain(`"cardRevision": "${card.revision}"`);
    expect(cardTarget({ ...card, truth: !card.truth, revision: 'changed' })).not.toEqual(target);
    expect(cardTarget({ ...card, text: card.text + '修正' })).not.toEqual(target);
    for (const c of swipeCards.filter(c => !c.correctChoiceTruth).slice(0, 5)) {
      const text = swipeCopyText(questionById(c.questionId)!, c, true, null);
      expect(text).toContain(`【このカードの試験当時の判定】${c.truth ? '○' : '×'}`);
      expect(text).toContain('【自分の○×解答】わからない');
      const json = text.match(/```json\n([\s\S]*?)\n```/)![1];
      expect(parseAppExplanation(json, cardTarget(c)).choiceId).toBe(c.choiceId);
    }
  });
});
