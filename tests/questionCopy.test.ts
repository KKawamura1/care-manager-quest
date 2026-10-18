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
      expect(text.indexOf('【問題文】')).toBeLessThan(text.indexOf('【選択肢】'));
      expect(text.indexOf('【選択肢】')).toBeLessThan(text.indexOf('【登録先の対象情報（回答への再出力不要）】'));
      expect(text.trimEnd().endsWith('```')).toBe(true);
    }
  });
  it('includes the official answer and submitted choices only when requested', () => {
    const question = questions[0];
    const text = questionCopyText(question, true, ['5', '4']);
    expect(text).toContain(`【試験当時の公式正答】\n${question.answerIds.join('・')}`);
    expect(text).toContain('【自分の解答】5・4');
    expect(text).toContain('背景を含めて自由に解説');
    expect(text).not.toContain('【アプリの解説】');
    expect(text).not.toContain('【原典】');
  });
  it('labels unproofread text and excludes existing explanations to keep the prompt concise', () => {
    for (const question of questions.filter(question => question.original?.textStatus === 'pending')) {
      expect(questionCopyText(question)).toContain('文字校正が未完了');
    }
    const legacy = legacyQuestions[0];
    expect(questionCopyText(legacy, true)).not.toContain(legacy.explanation);
    expect(questionCopyText(legacy)).not.toContain(legacy.explanation);
  });
});
