import { historyQuestions, questions } from '../data/provider';
import { awardXp, emptyPlayer, isCorrect } from './game';
import type { PlayerState } from './models';
export const STORAGE_KEY = 'care-manager-quest:v1';
export const MAX_IMPORT_BYTES = 2_000_000;
export function validExternalUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && u.hostname === 'keamane.kakomonn.com' && !u.port && !u.username && !u.password && /^\/questions\/\d+\/?$/.test(u.pathname) && !u.search && !u.hash;
  } catch { return false; }
}
const validConceptId = (id:string) => /^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(id) && !['constructor','prototype'].includes(id);
const fail = (): never => { throw new Error('履歴の形式が不正、またはこのバージョンと互換性がありません。'); };
const record = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : fail();
const str = (v: unknown, max = 200): string => typeof v === 'string' && v.length > 0 && v.length <= max ? v : fail();
const bool = (v: unknown): boolean => typeof v === 'boolean' ? v : fail();
const integer = (v: unknown, min = 0, max = 1_000_000): number => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : fail();
const arr = (v: unknown, max = 20_000): unknown[] => Array.isArray(v) && v.length <= max ? v : fail();
const strings = (v: unknown, max = 25): string[] => { const a = arr(v, max).map(x => str(x)); if (new Set(a).size !== a.length) fail(); return a; };
const date = (v: unknown): string => { const d = str(v, 40); if (!Number.isFinite(Date.parse(d))) fail(); return d; };
export function parsePlayer(text: string): PlayerState {
  if (new TextEncoder().encode(text).length > MAX_IMPORT_BYTES) throw new Error('履歴ファイルは2MB以内にしてください。');
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new Error('JSONファイルを読み取れません。'); }
  const root = record(value);
  if (root.schemaVersion !== 1 && root.schemaVersion !== 2) fail();
  const legacy = root.schemaVersion === 1;
  const player = emptyPlayer();
  const settings = record(root.settings);
  player.settings.sound = bool(settings.sound);
  for (const raw of arr(root.attempts)) {
    const a = record(raw);
    const q = historyQuestions.find(q => q.id === a.questionId && q.version === a.questionVersion) ?? fail();
    const selectedIds = strings(a.selectedIds, 5);
    if (selectedIds.length !== q.selectionCount || selectedIds.some(id => !q.options.some(o => o.id === id))) fail();
    const id = str(a.id), sessionId = str(a.sessionId);
    const previous = player.attempts.filter(p => p.sessionId === sessionId);
    if (previous.length >= 5 || player.attempts.some(p => p.id === id || (p.sessionId === sessionId && p.questionId === q.id))) fail();
    if (id !== `${sessionId}:${previous.length}`) fail();
    const correct = isCorrect(q, selectedIds);
    const firstSeen = !player.attempts.some(p => p.questionId === q.id);
    const combo = correct ? (previous.at(-1)?.combo ?? 0) + 1 : 0;
    const conceptIds = legacy ? [...q.conceptIds] : strings(a.conceptIds,64);
    if (!conceptIds.length || conceptIds.some(id=>!validConceptId(id))) fail();
    const classificationRevision = legacy ? 1 : integer(a.classificationRevision,1,10_000);
    const difficulty = (legacy ? q.difficulty : integer(a.difficulty,1,3)) as 1|2|3;
    const xp = awardXp({...q,difficulty}, correct, firstSeen, combo);
    if (bool(a.correct) !== correct || bool(a.firstSeen) !== firstSeen || integer(a.combo,0,5) !== combo || integer(a.xp) !== xp) fail();
    player.attempts.push({ id, sessionId, questionId: q.id, questionVersion: q.version, selectedIds, correct, firstSeen, combo, xp, at: date(a.at), conceptIds, classificationRevision, difficulty });
    for (const conceptId of conceptIds) {
      const p = player.concepts[conceptId] ?? { seenQuestionIds: [], correctQuestionIds: [], reflected: false };
      player.concepts[conceptId] = { ...p, seenQuestionIds: [...new Set([...p.seenQuestionIds,q.id])], correctQuestionIds: [...new Set([...p.correctQuestionIds,...(correct?[q.id]:[])])] };
    }
  }
  const evidence = record(root.concepts);
  for (const [id, raw] of Object.entries(evidence)) {
    if (!validConceptId(id)) fail();
    const e = record(raw), p = player.concepts[id];
    const seen = strings(e.seenQuestionIds,250), correct = strings(e.correctQuestionIds,250);
    if (!p || seen.length !== p.seenQuestionIds.length || correct.length !== p.correctQuestionIds.length || seen.some(x => !p.seenQuestionIds.includes(x)) || correct.some(x => !p.correctQuestionIds.includes(x))) fail();
    p.reflected = bool(e.reflected);
  }
  if (Object.keys(evidence).length !== Object.keys(player.concepts).length) fail();
  const externalIds = new Set<string>();
  player.externalRecords = arr(root.externalRecords,2000).map(raw => {
    const e = record(raw), url = str(e.url,500), id = str(e.id);
    if (!validExternalUrl(url) || externalIds.has(id)) fail();
    externalIds.add(id);
    return { id, url, label: str(e.label,100), correct: bool(e.correct), at: date(e.at) };
  });
  if (root.session !== undefined) {
    const s = record(root.session), questionIds = strings(s.questionIds,5), index = integer(s.index,0,4), id = str(s.id);
    if (questionIds.length !== 5 || questionIds.some(id => !historyQuestions.some(q => q.id === id))) fail();
    const selectedIds = strings(s.selectedIds,5), completed = bool(s.completed);
    const q = historyQuestions.find(q => q.id === questionIds[index])!;
    if (selectedIds.length > q.selectionCount || selectedIds.some(id => !q.options.some(o => o.id === id))) fail();
    const attempts = player.attempts.filter(a => a.sessionId === id);
    if (attempts.some((a,i) => a.questionId !== questionIds[i]) || attempts.length < index || attempts.length > index+1 || (completed && (index !== 4 || attempts.length !== 5))) fail();
    const current = attempts[index];
    if (current && (current.selectedIds.length !== selectedIds.length || current.selectedIds.some(x=>!selectedIds.includes(x)))) fail();
    if (questionIds.every(id=>questions.some(q=>q.id===id))) player.session = { id, questionIds, index, selectedIds, completed };
  }
  return player;
}
export function loadPlayer(storage: Pick<Storage,'getItem'>): { player: PlayerState; error?: string; raw?: string; migrated?: boolean } {
  let raw: string | null = null;
  try { raw = storage.getItem(STORAGE_KEY); return { player: raw ? parsePlayer(raw) : emptyPlayer(), migrated:raw ? JSON.parse(raw).schemaVersion===1 : false, ...(raw && JSON.parse(raw).schemaVersion===1 ? {raw} : {}) };  }
  catch (error) { return { player: emptyPlayer(), error: error instanceof Error ? error.message : '保存領域を読み取れません。', raw: raw ?? undefined }; }
}
export function savePlayer(storage: Pick<Storage,'setItem'>, p: PlayerState): string | undefined {
  try { storage.setItem(STORAGE_KEY,JSON.stringify(p)); return undefined; }
  catch { return '履歴を保存できません。タブを閉じる前にJSONを書き出してください。'; }
}
