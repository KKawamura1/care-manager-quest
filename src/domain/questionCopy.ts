import type { Question } from './models';
import { officialNotice } from '../data/sources';
import type { SwipeCard } from './swipe';
import { cardTarget, explanationInstructions, questionTarget, type ExplanationTarget } from './appExplanation';

export function questionCopyText(question: Question, includeAnswer = false, selectedIds?: readonly string[], target: ExplanationTarget = questionTarget(question)): string {
  const lines = [
    '以下の問題について、①問題文と選択肢を再掲し、②背景を含めて自由に解説し、③最後にアプリ用の短い解説を出してください。',
    '制度が変わっている場合は、試験当時と現在を区別してください。',
    '',
    question.title, `選択する正答の数：${question.selectionCount}つ`,
  ];
  if (question.original) {
    lines.push(`出題年度：${question.original.year}年度／問題番号：問${question.original.number}`);
    if (question.original.textStatus === 'pending') {
      lines.push('※問題文・選択肢は文字校正が未完了です。誤記の可能性があります。');
    }
  }
  lines.push('', '【問題文】', question.stem, '', '【選択肢】', ...question.options.map(option => `${option.id}. ${option.text}`));
  if (includeAnswer) {
    lines.push('', question.original ? '【試験当時の公式正答】' : '【正答】', (question.answerVariants??[question.answerIds]).map(ids=>ids.join('・')).join(' または '));
    if (selectedIds) lines.push(`【自分の解答】${selectedIds.join('・')}`);
  }
  if (question.original) lines.push('', officialNotice);
  lines.push('', explanationInstructions(target));
  return lines.join('\n');
}

export function swipeCopyText(question: Question, card: SwipeCard, includeAnswer = false, answer?: boolean | null): string {
  const focus = ['○×学習：元の設問の条件に沿って、対象の選択肢を重点的に解説してください。', `【対象の選択肢】${card.choiceId}. ${card.text}`];
  if (includeAnswer) {
    focus.push(`【このカードの試験当時の判定】${card.truth ? '○' : '×'}`);
    if (answer !== undefined) focus.push(`【自分の○×解答】${answer === null ? 'わからない' : answer ? '○' : '×'}`);
  }
  return [...focus, '', questionCopyText(question, includeAnswer, undefined, cardTarget(card))].join('\n');
}
