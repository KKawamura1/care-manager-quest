import type { Attempt, ConceptProgress, PlayerState, Question, Session } from './models';
export const emptyPlayer = (): PlayerState => ({ schemaVersion: 2, attempts: [], concepts: {}, externalRecords: [], settings: { sound: true } });
export const totalXp = (p: PlayerState) => p.attempts.reduce((sum, a) => sum + a.xp, 0);
export const levelInfo = (xp: number) => ({ level: Math.floor(xp / 200) + 1, current: xp % 200, next: 200 - xp % 200 });
export const conceptStatus = (p?: ConceptProgress): 'unexplored' | 'learning' | 'mastered' => !p?.seenQuestionIds.length ? 'unexplored' : p.reflected && p.correctQuestionIds.length >= 2 ? 'mastered' : 'learning';
export function isCorrect(q: Question, ids: readonly string[]): boolean {
  const keys = q.answerVariants ?? [q.answerIds];
  return ids.length === q.selectionCount && new Set(ids).size === ids.length && keys.some(key => key.length === ids.length && key.every(id => ids.includes(id)));
}
export function awardXp(q: Question, correct: boolean, first: boolean, combo: number): number {
  return correct ? 30 + q.difficulty * 10 + (first ? 20 : 0) + Math.min(Math.max(combo - 1, 0), 4) * 10 : 10;
}
export function buildSession(pool: readonly Question[], attempts: readonly Attempt[], id: string, random = Math.random): Session {
  const rhythm = [1, 2, 3, 1, 2];
  const selected: string[] = [];
  for (const difficulty of rhythm) {
    const unused = pool.filter(q => !selected.includes(q.id));
    const minimumSeen = Math.min(...unused.map(q=>attempts.filter(a=>a.questionId===q.id).length));
    const leastSeen = unused.filter(q=>attempts.filter(a=>a.questionId===q.id).length===minimumSeen);
    const matching = leastSeen.filter(q => q.difficulty === difficulty);
    const candidates = matching.length ? matching : leastSeen;
    if (!candidates.length) throw new Error('5問以上の問題が必要です。');
    const counts = candidates.map(q => attempts.filter(a => a.questionId === q.id).length);
    const minimum = Math.min(...counts);
    const preferred = candidates.filter((_, i) => counts[i] === minimum);
    const chosen = preferred[Math.min(Math.floor(random() * preferred.length), preferred.length - 1)];
    selected.push(chosen.id);
  }
  return { id, questionIds: selected, index: 0, selectedIds: [], completed: false };
}
export function submitAnswer(p: PlayerState, pool: readonly Question[], at: string): PlayerState {
  const s = p.session;
  if (!s || s.completed) return p;
  const q = pool.find(q => q.id === s.questionIds[s.index]);
  if (!q || s.selectedIds.length !== q.selectionCount || s.selectedIds.some(id => !q.options.some(o => o.id === id))) return p;
  const id = `${s.id}:${s.index}`;
  if (p.attempts.some(a => a.id === id)) return p;
  const correct = isCorrect(q, s.selectedIds);
  const previous = p.attempts.filter(a => a.sessionId === s.id).at(-1);
  const combo = correct ? (previous?.combo ?? 0) + 1 : 0;
  const firstSeen = !p.attempts.some(a => a.questionId === q.id);
  const attempt: Attempt = { id, questionId: q.id, questionVersion: q.version, sessionId: s.id, selectedIds: [...s.selectedIds], correct, firstSeen, combo, xp: awardXp(q, correct, firstSeen, combo), at, conceptIds:[...q.conceptIds], classificationRevision:q.classificationRevision??1, difficulty:q.difficulty };
  const evidence = { ...p.concepts };
  for (const conceptId of q.conceptIds) {
    const prior = evidence[conceptId] ?? { seenQuestionIds: [], correctQuestionIds: [], reflected: false };
    evidence[conceptId] = {
      ...prior,
      seenQuestionIds: [...new Set([...prior.seenQuestionIds, q.id])],
      correctQuestionIds: [...new Set([...prior.correctQuestionIds, ...(correct ? [q.id] : [])])],
    };
  }
  return { ...p, attempts: [...p.attempts, attempt], concepts: evidence };
}
export function advance(p: PlayerState): PlayerState {
  const s = p.session;
  if (!s || s.completed || !p.attempts.some(a => a.id === `${s.id}:${s.index}`)) return p;
  return { ...p, session: s.index === 4 ? { ...s, completed: true } : { ...s, index: s.index + 1, selectedIds: [] } };
}
export function reflect(p: PlayerState, conceptIds: string[]): PlayerState {
  const evidence = { ...p.concepts };
  for (const id of conceptIds) if (evidence[id]) evidence[id] = { ...evidence[id], reflected: true };
  return { ...p, concepts: evidence };
}

