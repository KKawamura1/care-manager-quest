import { describe, expect, it } from 'vitest';
import { cardTarget, questionTarget } from '../src/domain/appExplanation';
import { questionCopyText, swipeCopyText } from '../src/domain/questionCopy';
import { questionById, questions } from '../src/data/provider';
import { swipeCards } from '../src/data/swipe-provider';

describe('ChatGPT short explanations', () => {
  const card = swipeCards.find(c => c.year === 2020)!;
  const question = questionById(card.questionId)!;
  const target = cardTarget(card);
  it('keeps exact registration metadata without requesting an explanation JSON response', () => {
    for (const q of questions) {
      const text = questionCopyText(q);
      expect(text).toContain('docs/register-explanation.md');
      expect(text).toContain('PRと追加承認の省略');
      const json = text.match(/```json\n([\s\S]*?)\n```/)![1];
      expect(JSON.parse(json)).toEqual({ schemaVersion:1, ...questionTarget(q) });
      expect(JSON.parse(json)).not.toHaveProperty('explanation');
      expect(text).toContain('回答への再出力不要');
      expect(text).not.toContain('回答の最後に独立したJSONコードブロックで出してください');
      expect(text).not.toContain('アプリ用の短い解説');
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
      expect(JSON.parse(json)).toEqual({ schemaVersion:1, ...cardTarget(c) });
    }
  });
});
