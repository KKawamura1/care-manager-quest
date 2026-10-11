import type { Question } from './models';

export interface TruthRecord {
  mode: string;
  correctChoiceTruth: string;
  choiceAnswers: string[];
  sourceReview?: Record<string, unknown>;
  reason?: string;
}
export interface TopicRecord {
  primaryConceptId: string | null;
  relatedConceptIds: string[];
  status: string;
  classificationRevision?: number;
  revision?: number;
  isPlayable?: boolean;
}
export interface SwipeCard {
  id: string; questionId: string; questionVersion: number; choiceId: string;
  year: number; number: number; domain: string; stem: string; text: string; truth: boolean;
  correctChoiceTruth: boolean; explanation: string; topicId?: string;
  classificationStatus: string; classificationRevision: number;
  sourceReview?: Record<string, unknown>;
  // A changed truth label invalidates review mastery; taxonomy edits do not.
  revision: string;
}
export interface CardIssue { questionId: string; choiceId?: string; reason: string }
const singleTopicStatuses = new Set(['provisional_topic_classified', 'editorial_draft_from_topic_metadata', 'editorial_draft_from_prior_manual_review']);

export function buildSwipeCards(questions: readonly Question[], truth: Record<string, TruthRecord>, topics: Record<string, TopicRecord>, conceptIds: ReadonlySet<string>) {
  const cards: SwipeCard[] = [], excluded: CardIssue[] = [], unclassified: CardIssue[] = [];
  for (const q of questions) {
    // The 2020 pack retains care_manager_2020_NNN IDs for existing history.
    // New taxonomy/truth data uses YYYY-NN; join by the original exam identity.
    const lookupId = q.original ? `${q.original.year}-${String(q.original.number).padStart(2, '0')}` : q.id;
    const record = truth[lookupId], topic = topics[lookupId];
    const reject = (reason: string, choiceId?: string) => excluded.push({ questionId: q.id, choiceId, reason });
    if (!q.original || !record || record.mode !== 'choice_correctness' || !['true', 'false'].includes(record.correctChoiceTruth) || topic?.isPlayable === false) {
      reject(record?.reason ?? '有効な○×判定がありません'); continue;
    }
    if (!q.stem.trim() || q.options.length !== 5 || record.choiceAnswers.length !== 5 || q.options.some((o, i) => o.id !== String(i + 1) || !o.text.trim())) {
      reject('本文・選択肢・判定データの対応が不完全です'); continue;
    }
    const variants = q.answerVariants ?? [q.answerIds];
    const correctChoiceTruth = record.correctChoiceTruth === 'true';
    const topicId = topic && singleTopicStatuses.has(topic.status) && topic.relatedConceptIds.length === 0 && topic.primaryConceptId && conceptIds.has(topic.primaryConceptId) ? topic.primaryConceptId : undefined;
    for (const [i, option] of q.options.entries()) {
      const label = record.choiceAnswers[i];
      const truths = new Set(variants.map(ids => ids.includes(option.id) === correctChoiceTruth));
      if (truths.size !== 1) { reject('複数の正答パターンで真偽が一致しません', option.id); continue; }
      if (!['○', '×'].includes(label) || (label === '○') !== [...truths][0]) {
        reject('登録済み○×判定と試験当時の正答が一致しません', option.id); continue;
      }
      if (!topicId) unclassified.push({ questionId: q.id, choiceId: option.id, reason: '選択肢別分類が未確認、または複数の論点が含まれます' });
      cards.push({ id: `${q.id}:${option.id}`, questionId: q.id, questionVersion: q.version, choiceId: option.id,
        year: q.original.year, number: q.original.number, domain: q.domain ?? '', stem: q.stem, text: option.text, truth: label === '○', correctChoiceTruth,
        explanation: option.explanation, topicId, classificationStatus: topic?.status ?? 'missing', classificationRevision: topic?.classificationRevision ?? topic?.revision ?? 1,
        sourceReview: record.sourceReview, revision: `${q.version}:${label}` });
    }
  }
  return { cards, excluded, unclassified };
}

export interface CardProgress {
  revision: string; reviews: number; correct: number; streak: number; lapses: number;
  lastCorrect: boolean; lastAnswer: boolean; lastReviewedAt: string; dueAt: string;
}
export interface SwipeState { schemaVersion: 1; progress: Record<string, CardProgress> }
export const emptySwipe = (): SwipeState => ({ schemaVersion: 1, progress: {} });
const DAY = 86_400_000;
// First recall: tomorrow. Subsequent successes: 3, 7, 14, 30, 60 days.
const intervals = [1, 3, 7, 14, 30, 60];
export function recordSwipe(state: SwipeState, card: SwipeCard, answer: boolean, now: number): SwipeState {
  const old = state.progress[card.id]?.revision === card.revision ? state.progress[card.id] : undefined;
  const correct = answer === card.truth, streak = correct ? (old?.streak ?? 0) + 1 : 0;
  const delay = correct ? intervals[Math.min(streak - 1, intervals.length - 1)] * DAY : 60_000;
  return { ...state, progress: { ...state.progress, [card.id]: {
    revision: card.revision, reviews: (old?.reviews ?? 0) + 1, correct: (old?.correct ?? 0) + Number(correct),
    streak, lapses: (old?.lapses ?? 0) + Number(!correct), lastCorrect: correct, lastAnswer: answer,
    lastReviewedAt: new Date(now).toISOString(), dueAt: new Date(now + delay).toISOString(),
  } } };
}
export function progressFor(state: SwipeState, card: SwipeCard): CardProgress | undefined {
  const p = state.progress[card.id]; return p?.revision === card.revision ? p : undefined;
}
export function reviewQueue(cards: readonly SwipeCard[], state: SwipeState, now: number): SwipeCard[] {
  return cards.filter(card => { const p = progressFor(state, card); return !p || Date.parse(p.dueAt) <= now; }).sort((a, b) => {
    const x = progressFor(state, a), y = progressFor(state, b);
    const rank = (p?: CardProgress) => !p ? 2 : p.lastCorrect ? 1 : 0;
    return rank(x) - rank(y) || (x && y ? Date.parse(x.dueAt) - Date.parse(y.dueAt) : 0) || b.year - a.year || a.id.localeCompare(b.id);
  });
}
export function filterSwipeCards(cards: readonly SwipeCard[], year: number | 'all', topic: string) {
  return cards.filter(c => (year === 'all' || c.year === year) && (topic === 'all' || (topic === 'unclassified' ? !c.topicId : c.topicId === topic)));
}
