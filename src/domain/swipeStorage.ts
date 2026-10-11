import type { SwipeCard, SwipeState, CardProgress } from './swipe';
import { emptySwipe } from './swipe';
export const SWIPE_STORAGE_KEY = 'care-manager-quest:swipe:v1';
export const SWIPE_IMPORT_BYTES = 4_000_000;
const fail = (): never => { throw new Error('○×履歴の形式が不正です。元のデータは保持しています。'); };
const object = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : fail();
const integer = (v: unknown): number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 ? v : fail();
const boolean = (v: unknown): boolean => typeof v === 'boolean' ? v : fail();
const date = (v: unknown): string => typeof v === 'string' && v.length <= 40 && Number.isFinite(Date.parse(v)) ? v : fail();
export function parseSwipe(text: string, cards: ReadonlyMap<string, SwipeCard>): SwipeState {
  if (new TextEncoder().encode(text).length > SWIPE_IMPORT_BYTES) fail();
  let parsed: unknown; try { parsed = JSON.parse(text); } catch { fail(); }
  const root = object(parsed); if (root.schemaVersion !== 1) fail();
  const result = emptySwipe(), progress = object(root.progress);
  if (Object.keys(progress).length > cards.size) fail();
  for (const [id, raw] of Object.entries(progress)) {
    if (!cards.has(id)) fail();
    const r = object(raw), revision = r.revision;
    if (typeof revision !== 'string' || !/^\d+:[○×]$/.test(revision)) fail();
    const reviews = integer(r.reviews), correct = integer(r.correct), streak = integer(r.streak), lapses = integer(r.lapses);
    const lastCorrect = boolean(r.lastCorrect), lastAnswer = boolean(r.lastAnswer), lastReviewedAt = date(r.lastReviewedAt), dueAt = date(r.dueAt);
    if (!reviews || correct > reviews || correct + lapses !== reviews || streak > correct || (lastCorrect ? streak < 1 : streak !== 0) || Date.parse(dueAt) <= Date.parse(lastReviewedAt)) fail();
    if (revision === cards.get(id)!.revision && lastCorrect !== (lastAnswer === cards.get(id)!.truth)) fail();
    result.progress[id] = { revision: revision as string, reviews, correct, streak, lapses, lastCorrect, lastAnswer, lastReviewedAt, dueAt } satisfies CardProgress;
  }
  return result;
}
export function loadSwipe(storage: Pick<Storage, 'getItem'>, cards: ReadonlyMap<string, SwipeCard>): { state: SwipeState; error?: string; raw?: string } {
  let raw: string | null = null;
  try { raw = storage.getItem(SWIPE_STORAGE_KEY); return { state: raw ? parseSwipe(raw, cards) : emptySwipe() }; }
  catch (e) { return { state: emptySwipe(), raw: raw ?? undefined, error: e instanceof Error ? e.message : '○×履歴を読み取れません。' }; }
}
