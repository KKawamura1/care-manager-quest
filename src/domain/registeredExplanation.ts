import { parseAppExplanation, type AppExplanation, type ExplanationTarget } from './appExplanation';

export interface RegisteredExplanation extends AppExplanation {
  registrationId: string;
  registeredAt: string;
  questionRevision?: string;
  sources?: { title: string; url: string }[];
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const stamp = /^[0-9a-f]{1,8}$/;

export function parseRegisteredExplanation(value: unknown, path: string): RegisteredExplanation {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('登録JSONはオブジェクトにしてください');
  const d = value as Record<string, unknown>;
  if (typeof d.registrationId !== 'string' || !uuid.test(d.registrationId)
    || !path.endsWith(`/${d.registrationId}.json`)) throw new Error('UUIDとファイル名が一致しません');
  if (typeof d.registeredAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(d.registeredAt)
    || !Number.isFinite(Date.parse(d.registeredAt)) || new Date(d.registeredAt).toISOString().slice(0,19) !== d.registeredAt.slice(0,19)) throw new Error('registeredAtは実際の登録日時をUTCで指定してください');
  if (typeof d.questionId !== 'string' || !/^(?:20\d{2}-\d{2}|care_manager_2020_\d{3})$/.test(d.questionId)
    || !Number.isInteger(d.questionVersion) || (d.questionVersion as number) < 1) throw new Error('問題ID・版が不正です');
  if (d.choiceId !== undefined) {
    if (typeof d.choiceId !== 'string' || !/^[1-5]$/.test(d.choiceId) || typeof d.cardRevision !== 'string' || !stamp.test(d.cardRevision)) throw new Error('選択肢ID・cardRevisionが不正です');
  } else if (d.cardRevision !== undefined || typeof d.questionRevision !== 'string' || !stamp.test(d.questionRevision)) throw new Error('問題全体の解説にはquestionRevisionが必要です');
  if (d.sources !== undefined && (!Array.isArray(d.sources) || d.sources.length > 10 || d.sources.some(s => {
    if (!s || typeof s !== 'object' || typeof s.title !== 'string' || !s.title.trim() || s.title.length > 200 || typeof s.url !== 'string') return true;
    try { const url = new URL(s.url); return url.protocol !== 'https:' || Boolean(url.username || url.password); } catch { return true; }
  }))) throw new Error('出典はタイトルとHTTPSのURLで指定してください');
  const target = { questionId:d.questionId, questionVersion:d.questionVersion as number, choiceId:d.choiceId as string | undefined,
    cardRevision:d.cardRevision as string | undefined, questionRevision:d.questionRevision as string | undefined };
  const parsed = parseAppExplanation(JSON.stringify(d), target);
  return { ...parsed, registrationId:d.registrationId, registeredAt:d.registeredAt, sources:d.sources as RegisteredExplanation['sources'] };
}

// Filter before sorting: a stale correction must never hide a still-valid entry.
export function matchingRegisteredExplanations(entries: readonly RegisteredExplanation[], target: ExplanationTarget): RegisteredExplanation[] {
  return entries.filter(e => e.questionId === target.questionId && e.questionVersion === target.questionVersion
    && e.choiceId === target.choiceId && e.cardRevision === target.cardRevision
    && (target.choiceId !== undefined || e.questionRevision === target.questionRevision))
    .sort((a,b) => Date.parse(b.registeredAt) - Date.parse(a.registeredAt) || (a.registrationId < b.registrationId ? 1 : a.registrationId > b.registrationId ? -1 : 0));
}
