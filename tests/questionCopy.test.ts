import { describe, expect, it } from 'vitest';
import { questions, legacyQuestions } from '../src/data/provider';
import { questionCopyText } from '../src/domain/questionCopy';

describe('question copy payload', () => {
  it('preserves every official stem and option without exposing the answer before submission', () => {
    for (const question of questions) {
      const text = questionCopyText(question);
      expect(text).toContain(question.stem);
      for (const option of question.options) expect(text).toContain(`${option.id}. ${option.text}`);
      expect(text).toContain(`選択する正答の数：${question.selectionCount}つ`);
      expect(text).toContain(`問題番号：問${question.original!.number}`);
      expect(text).toContain('問題の著作権：公益財団法人 社会福祉振興・試験センター');
      expect(text).not.toContain('【試験当時の公式正答】');
      expect(text).not.toContain('正答番号：');
      expect(text).not.toContain('【自分の解答】');
    }
  });
  it('includes the official answer and submitted choices only when requested', () => {
    const question = questions[0];
    const text = questionCopyText(question, true, ['5', '4']);
    expect(text).toContain(`【試験当時の公式正答】\n${question.answerIds.join('・')}`);
    expect(text).toContain('【自分の解答】5・4');
    expect(text).toContain('アプリの独自解説は未登録です。');
    expect(text).toContain('現行法への適合性は未確認です。');
  });
  it('labels unproofread text and retains legacy explanations', () => {
    for (const question of questions.filter(question => question.original?.textStatus === 'pending')) {
      expect(questionCopyText(question)).toContain('文字校正が未完了');
    }
    const legacy = legacyQuestions[0];
    expect(questionCopyText(legacy, true)).toContain(legacy.explanation);
    expect(questionCopyText(legacy)).not.toContain(legacy.explanation);
  });
});
