import type { Question } from './models';
import { officialNotice, sources } from '../data/sources';
import type { SwipeCard } from './swipe';
import { cardTarget, explanationInstructions, questionTarget, type ExplanationTarget } from './appExplanation';

export function questionCopyText(question: Question, includeAnswer = false, selectedIds?: readonly string[], target: ExplanationTarget = questionTarget(question)): string {
  const lines = [
    '以下の介護支援専門員試験の問題について、問われている知識と各選択肢の理由をわかりやすく解説してください。',
    '試験当時の制度に基づいて説明し、現行制度との違いがある場合は区別してください。根拠となる一次資料も示してください。',
    '', question.title, `選択する正答の数：${question.selectionCount}つ`,
  ];
  if (question.original) {
    lines.push(`出題年度：${question.original.year}年度／問題番号：問${question.original.number}`);
    if (question.original.textStatus === 'pending') {
      lines.push(`【注意】以下の問題文・選択肢は文字校正が未完了です。転記誤りの可能性があるため、${question.original.imagePath?'原典の同じ問題の原本画像':'取得元に掲載された同じ問題'}と照合してください。`);
    }
  }
  lines.push('', '【問題文】', question.stem, '', '【選択肢】', ...question.options.map(option => `${option.id}. ${option.text}`));
  if (includeAnswer) {
    lines.push('', question.original ? '【試験当時の公式正答】' : '【正答】', (question.answerVariants??[question.answerIds]).map(ids=>ids.join('・')).join(' または '));
    if (selectedIds) lines.push(`【自分の解答】${selectedIds.join('・')}`);
    if (question.explanation) lines.push('', '【アプリの解説】', question.explanation);
    if (question.reasoning) lines.push(question.reasoning);
    for (const option of question.options) {
      if (option.explanation) lines.push(`${option.id}. ${option.explanation}`);
    }
    if (question.original && !question.explanation) lines.push('アプリの独自解説は未登録です。');
  }
  if (question.original) lines.push('', '現行法への適合性は未確認です。');
  const references = question.provenance.sources.flatMap(reference => {
    const source = sources.find(source => source.id === reference.sourceId);
    return source ? [`${source.title}\n${source.url}`] : [];
  });
  if (references.length) lines.push('', '【原典】', ...references);
  lines.push('', question.original ? officialNotice : `作成者：${question.provenance.author}（旧練習問題）`);
  lines.push('', explanationInstructions(target));
  return lines.join('\n');
}

export function swipeCopyText(question: Question, card: SwipeCard, includeAnswer = false, answer?: boolean | null): string {
  const focus = ['○×学習で質問したいのは、次の選択肢です。元の設問の条件に沿って、この選択肢を重点的に解説してください。', `【対象の選択肢】${card.choiceId}. ${card.text}`];
  if (includeAnswer) {
    focus.push(`【このカードの試験当時の判定】${card.truth ? '○' : '×'}`);
    if (answer !== undefined) focus.push(`【自分の○×解答】${answer === null ? 'わからない' : answer ? '○' : '×'}`);
  }
  return [...focus, '', questionCopyText(question, includeAnswer, undefined, cardTarget(card))].join('\n');
}

