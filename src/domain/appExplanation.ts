import type { Question } from './models';
import type { SwipeCard } from './swipe';

export interface ExplanationTarget {
  questionId: string;
  questionVersion: number;
  choiceId?: string;
  cardRevision?: string;
}
export interface AppExplanation extends ExplanationTarget { schemaVersion: 1; explanation: string }
export const EXPLANATION_MAX_LENGTH = 600;
export const questionTarget = (q: Question): ExplanationTarget => ({ questionId: q.id, questionVersion: q.version });
// The review revision contains the truth label. Use an opaque content stamp in
// the prompt so copying before answering does not reveal that label.
export const cardTarget = (c: SwipeCard): ExplanationTarget => {
  let hash = 2166136261;
  for (const char of `${c.id}:${c.revision}:${c.stem}:${c.text}`) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return { questionId: c.questionId, questionVersion: c.questionVersion, choiceId: c.choiceId, cardRevision: (hash >>> 0).toString(16) };
};
export const explanationStorageKey = (t: ExplanationTarget) => `care-manager-quest:explanation:v1:${t.questionId}:${t.choiceId ?? 'question'}`;

export function explanationInstructions(target: ExplanationTarget): string {
  return [
    '【回答形式】',
    'まず、通常の詳しい解説をしてください。',
    target.choiceId ? 'その後、この選択肢の○×の理由と覚えるポイントを、アプリ用に80〜180字程度でまとめてください。' : 'その後、この問題の正答の理由と覚えるポイントを、アプリ用に150〜300字程度でまとめてください。',
    '短い解説は詳しい解説と分け、次のJSONのexplanationだけを書き換えて、独立したJSONコードブロックを1つ出力してください。解説は600字以内のプレーンテキストにし、ID・版番号は変更しないでください。',
    '```json', JSON.stringify({ schemaVersion: 1, ...target, explanation: 'ここに短い解説' }, null, 2), '```',
  ].join('\n');
}

export function parseAppExplanation(raw: string, target: ExplanationTarget): AppExplanation {
  if (raw.length > 16_000) throw new Error('アプリ用の短い解説ブロックだけを貼り付けてください。');
  const text = raw.trim().replace(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i, '$1').trim();
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new Error('ChatGPTの「アプリ用の短い解説」のJSONブロックをコピーしてください。'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('解説の形式を読み取れません。');
  const data = value as Record<string, unknown>;
  if (data.schemaVersion !== 1 || data.questionId !== target.questionId || data.questionVersion !== target.questionVersion || data.choiceId !== target.choiceId || data.cardRevision !== target.cardRevision) {
    throw new Error('別の問題・選択肢、または古い版の解説です。今の問題をコピーして生成し直してください。');
  }
  if (typeof data.explanation !== 'string' || !data.explanation.trim() || data.explanation.trim().length > EXPLANATION_MAX_LENGTH) throw new Error('短い解説は1〜600字で入力してください。');
  return { schemaVersion: 1, ...target, explanation: data.explanation.trim() };
}
