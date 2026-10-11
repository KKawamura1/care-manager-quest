import type { Question } from './models';

export interface TruthRecord {
  mode: string;
  correctChoiceTruth: string;
  choiceAnswers: string[];
  sourceReview?: Record<string, unknown>;
  reason?: string;
}
export interface TopicRecord {
  drawerIds: string[];
  reviewed: boolean;
}
export interface SwipeCard {
  id: string; questionId: string; questionVersion: number; choiceId: string;
  year: number; number: number; domain: string; stem: string; text: string; truth: boolean;
  correctChoiceTruth: boolean; explanation: string; topicId?: string; topicIds: string[];
  classificationStatus: string; classificationRevision: number;
  sourceReview?: Record<string, unknown>;
  // A changed truth label invalidates review mastery; taxonomy edits do not.
  revision: string;
}
export interface CardIssue { questionId: string; choiceId?: string; reason: string }
export function buildSwipeCards(questions: readonly Question[], truth: Record<string, TruthRecord>, topics: Record<string, TopicRecord>, conceptIds: ReadonlySet<string>, classificationRevision = 4) {
  const cards: SwipeCard[] = [], excluded: CardIssue[] = [], unclassified: CardIssue[] = [];
  for (const q of questions) {
    // The 2020 pack retains care_manager_2020_NNN IDs for existing history.
    // New taxonomy/truth data uses YYYY-NN; join by the original exam identity.
    const lookupId = q.original ? `${q.original.year}-${String(q.original.number).padStart(2, '0')}` : q.id;
    const record = truth[lookupId];
    const reject = (reason: string, choiceId?: string) => excluded.push({ questionId: q.id, choiceId, reason });
    if (!q.original || !record || record.mode !== 'choice_correctness' || !['true', 'false'].includes(record.correctChoiceTruth)) {
      reject(record?.reason ?? '有効な○×判定がありません'); continue;
    }
    if (!q.stem.trim() || q.options.length !== 5 || record.choiceAnswers.length !== 5 || q.options.some((o, i) => o.id !== String(i + 1) || !o.text.trim())) {
      reject('本文・選択肢・判定データの対応が不完全です'); continue;
    }
    const variants = q.answerVariants ?? [q.answerIds];
    const correctChoiceTruth = record.correctChoiceTruth === 'true';
    for (const [i, option] of q.options.entries()) {
      const topic = topics[`${lookupId}:${option.id}`];
      const topicIds = [...new Set(topic?.drawerIds ?? [])].filter(id => conceptIds.has(id));
      const topicId = topicIds[0];
      const label = record.choiceAnswers[i];
      const truths = new Set(variants.map(ids => ids.includes(option.id) === correctChoiceTruth));
      if (truths.size !== 1) { reject('複数の正答パターンで真偽が一致しません', option.id); continue; }
      if (!['○', '×'].includes(label) || (label === '○') !== [...truths][0]) {
        reject('登録済み○×判定と試験当時の正答が一致しません', option.id); continue;
      }
      if (!topicIds.length) unclassified.push({ questionId: q.id, choiceId: option.id, reason: '選択肢の分類がありません' });
      cards.push({ id: `${q.id}:${option.id}`, questionId: q.id, questionVersion: q.version, choiceId: option.id,
        year: q.original.year, number: q.original.number, domain: q.domain ?? '', stem: q.stem, text: option.text, truth: label === '○', correctChoiceTruth,
        explanation: option.explanation, topicId, topicIds, classificationStatus: !topicIds.length ? 'missing' : topic.reviewed ? 'reviewed' : 'provisional', classificationRevision,
        sourceReview: record.sourceReview, revision: `${q.version}:${label}` });
    }
  }
  return { cards, excluded, unclassified };
}

export interface CardProgress {
  revision: string; reviews: number; correct: number; streak: number; lapses: number;
  lastCorrect: boolean; lastAnswer: boolean | null; lastReviewedAt: string; dueAt: string;
}
export interface SwipeState { schemaVersion: 1; progress: Record<string, CardProgress> }
export const emptySwipe = (): SwipeState => ({ schemaVersion: 1, progress: {} });
const DAY = 86_400_000;
// First recall: tomorrow. Subsequent successes: 3, 7, 14, 30, 60 days.
const intervals = [1, 3, 7, 14, 30, 60];
export function recordSwipe(state: SwipeState, card: SwipeCard, answer: boolean | null, now: number): SwipeState {
  const old = state.progress[card.id]?.revision === card.revision ? state.progress[card.id] : undefined;
  const correct = answer !== null && answer === card.truth, streak = correct ? (old?.streak ?? 0) + 1 : 0;
  const delay = correct ? intervals[Math.min(streak - 1, intervals.length - 1)] * DAY : DAY;
  return { ...state, progress: { ...state.progress, [card.id]: {
    revision: card.revision, reviews: (old?.reviews ?? 0) + 1, correct: (old?.correct ?? 0) + Number(correct),
    streak, lapses: (old?.lapses ?? 0) + Number(!correct), lastCorrect: correct, lastAnswer: answer,
    lastReviewedAt: new Date(now).toISOString(), dueAt: new Date(now + delay).toISOString(),
  } } };
}
export function progressFor(state: SwipeState, card: SwipeCard): CardProgress | undefined {
  const p = state.progress[card.id]; return p?.revision === card.revision ? p : undefined;
}
// Keep every choice from the same original exam question out for 24 hours after
// any of its choices has been answered. Read all saved progress (not just the
// selected topic) so switching filters or revising a card cannot bypass it.
function lastReviewByQuestion(state: SwipeState): Map<string, number> {
  const latest = new Map<string, number>();
  for (const [id, progress] of Object.entries(state.progress)) {
    const separator = id.lastIndexOf(':');
    if (separator < 0) continue;
    const questionId = id.slice(0, separator);
    const reviewedAt = Date.parse(progress.lastReviewedAt);
    if (Number.isFinite(reviewedAt) && reviewedAt > (latest.get(questionId) ?? -Infinity)) {
      latest.set(questionId, reviewedAt);
    }
  }
  return latest;
}

function eligibleAt(card: SwipeCard, state: SwipeState, lastReviewed: ReadonlyMap<string, number>): number {
  const progress = progressFor(state, card);
  return Math.max(
    progress ? Date.parse(progress.dueAt) : -Infinity,
    (lastReviewed.get(card.questionId) ?? -Infinity) + DAY,
  );
}

// Useful when all candidate cards are on cooldown, including unseen sibling choices.
export function nextSwipeAvailableAt(cards: readonly SwipeCard[], state: SwipeState, now: number): number | undefined {
  const lastReviewed = lastReviewByQuestion(state);
  let earliest = Infinity;
  for (const card of cards) {
    const at = eligibleAt(card, state, lastReviewed);
    if (at > now && at < earliest) earliest = at;
  }
  return earliest === Infinity ? undefined : earliest;
}

// Pick each next card from a 70% new / 20% overdue mistake / 10% overdue
// success lottery (among nonempty pools). Shuffle within pools, and fall back
// to available types automatically. This prevents overdue cards from starving
// unseen questions and never mutates the input.
export function reviewQueue(cards: readonly SwipeCard[], state: SwipeState, now: number, random: () => number = Math.random): SwipeCard[] {
  const lastReviewed = lastReviewByQuestion(state);
  const groups: SwipeCard[][] = [[], [], []]; // unseen, due mistakes, due successes
  const weights = [7, 2, 1];
  for (const card of cards) {
    if (eligibleAt(card, state, lastReviewed) > now) continue;
    const progress = progressFor(state, card);
    groups[!progress ? 0 : progress.lastCorrect ? 2 : 1].push(card);
  }
  for (const group of groups) {
    for (let i = group.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [group[i], group[j]] = [group[j], group[i]];
    }
  }
  const result: SwipeCard[] = [];
  while (groups.some(group => group.length)) {
    const totalWeight = groups.reduce((sum, group, i) => sum + (group.length ? weights[i] : 0), 0);
    let ticket = random() * totalWeight;
    let chosen = 0;
    for (let i = 0; i < groups.length; i++) {
      if (!groups[i].length) continue;
      ticket -= weights[i];
      chosen = i;
      if (ticket < 0) break;
    }
    result.push(groups[chosen].pop()!);
  }
  return result;
}
export function filterSwipeCards(cards: readonly SwipeCard[], year: number | 'all', topic: string) {
  return cards.filter(c => (year === 'all' || c.year === year) && (topic === 'all' || (topic === 'unclassified' ? !c.topicIds.length : c.topicIds.includes(topic))));
}
