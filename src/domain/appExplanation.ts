import type { Question } from './models';
import type { SwipeCard } from './swipe';

export interface ExplanationTarget {
  questionId: string;
  questionVersion: number;
  choiceId?: string;
  cardRevision?: string;
  questionRevision?: string;
}
export const EXPLANATION_MAX_LENGTH = 600;
export const questionTarget = (q: Question): ExplanationTarget => {
  let hash = 2166136261;
  for (const char of JSON.stringify([q.id,q.version,q.stem,q.options.map(o => [o.id,o.text]),q.answerVariants ?? [q.answerIds]])) hash = Math.imul(hash ^ char.charCodeAt(0),16777619);
  return { questionId:q.id, questionVersion:q.version, questionRevision:(hash >>> 0).toString(16) };
};
// The review revision contains the truth label. Use an opaque content stamp in
// the prompt so copying before answering does not reveal that label.
export const cardTarget = (c: SwipeCard): ExplanationTarget => {
  let hash = 2166136261;
  for (const char of `${c.id}:${c.revision}:${c.stem}:${c.text}`) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return { questionId: c.questionId, questionVersion: c.questionVersion, choiceId: c.choiceId, cardRevision: (hash >>> 0).toString(16) };
};
export function explanationInstructions(target: ExplanationTarget): string {
  return [
    '【後で「登録しといて」と依頼した場合の手順】',
    '対象リポジトリ：KKawamura1/care-manager-quest（main）',
    '最初に次の手順書をGitHub連携で読んでください：',
    'https://github.com/KKawamura1/care-manager-quest/blob/main/docs/register-explanation.md',
    '解説への回答は通常の文章で行ってください。登録用JSONの出力や、アプリへの貼り付けは不要です。',
    '解説の回答の最後に、必ず「この解説をアプリに登録しますか？」と尋ねてください。この確認への「はい」「お願いします」などの肯定も登録依頼として扱い、下の手順で登録してください。',
    'ユーザーが登録を依頼した場合、下の対象情報のID・版・改訂印をそのまま使い、この会話の解説を要約して、data/explanations/entries/<新しいUUID>.json を1ファイルだけ追加してください。',
    'この解説登録はユーザーによりmainへの直接登録・PRと追加承認の省略が許可されています。解説を求められただけでは登録しないでください。書込みツールが利用できない場合は、登録したと報告せず、その旨を伝えてください。',
    '',
    '【登録先の対象情報（回答への再出力不要）】',
    '```json', JSON.stringify({ schemaVersion: 1, ...target }, null, 2), '```',
  ].join('\n');
}
