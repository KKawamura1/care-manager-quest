import type { LearningEvent } from './models';
import type { SwipeCard, SwipeState } from './swipe';
import { emptySwipe, recordSwipe } from './swipe';

const DAY = 86_400_000;
const JST = 9 * 3_600_000;
export const LEARNING_WINDOW = 5;

/** Calendar date in Japan, independent of browser locale and timezone. */
export const learningDay = (at: string): string => new Date(Date.parse(at) + JST).toISOString().slice(0, 10);

export function firstDailyAnswers(events: readonly LearningEvent[], card?: SwipeCard): LearningEvent[] {
  const seen = new Set<string>();
  return events.filter(event => {
    if (card && (event.cardId !== card.id || event.revision !== card.revision)) return false;
    const key = event.cardId + ':' + event.revision + ':' + learningDay(event.at);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function learningLevel(events: readonly LearningEvent[], card: SwipeCard, count = LEARNING_WINDOW): number {
  const recent = firstDailyAnswers(events, card).slice(-count);
  const denominator = count * (count + 1) / 2;
  return recent.reduce((sum, event, i) =>
    sum + (event.answer !== null && event.answer === card.truth ? count - recent.length + i + 1 : 0), 0) / denominator;
}

export function reviewIntervalDays(level: number): number {
  return level < .3 ? 1 : level < .6 ? 3 : level < .9 ? 7 : 14;
}

export function reviewUrgency(events: readonly LearningEvent[], card: SwipeCard, now = Date.now()): number {
  const evaluated = firstDailyAnswers(events, card);
  if (!evaluated.length) return 0;
  const last = Date.parse(evaluated[evaluated.length - 1].at);
  return Math.max(0, now - last) / (DAY * reviewIntervalDays(learningLevel(events, card)));
}

export function recordLearning(
  current: readonly LearningEvent[],
  choices: readonly { card: SwipeCard; answer: boolean | null }[],
  at: string,
  mode: LearningEvent['mode'],
  perfect = false,
): LearningEvent[] {
  const day = learningDay(at);
  const existing = new Set(firstDailyAnswers(current).filter(event => learningDay(event.at) === day).map(event => event.cardId));
  const eligible = choices.filter(({card}) => !existing.has(card.id));
  const bonus = mode === 'five-choice' && perfect && choices.length === 5 && eligible.length === 5 ? 20 : 0;
  return [
    ...current,
    ...choices.map(({card, answer}, i) => ({
      cardId: card.id,
      revision: card.revision,
      answer,
      at,
      mode,
      xp: existing.has(card.id) ? 0 : answer !== null && answer === card.truth ? 10 : 2,
      bonusXp: i === 0 ? bonus : 0,
    })),
  ];
}

/** Reconstruct scheduling state from the same events used for XP and the knowledge map. */
export function swipeProgressFromEvents(events: readonly LearningEvent[], cards: ReadonlyMap<string, SwipeCard>): SwipeState {
  const state = emptySwipe();
  const evaluated = firstDailyAnswers(events);
  for (const event of evaluated) {
    const card = cards.get(event.cardId);
    if (!card || card.revision !== event.revision) continue;
    const old = state.progress[card.id];
    state.progress[card.id] = recordSwipe(
      { schemaVersion: 1, progress: old ? { [card.id]: old } : {} },
      card, event.answer, Date.parse(event.at)
    ).progress[card.id];
  }
  // Scheduling uses evidence-based retention, not short-term repeated practice.
  for (const [id, progress] of Object.entries(state.progress)) {
    const card = cards.get(id)!;
    progress.dueAt = new Date(Date.parse(progress.lastReviewedAt) +
      reviewIntervalDays(learningLevel(events, card)) * DAY).toISOString();
  }
  return state;
}

export const learningXp = (events: readonly LearningEvent[]): number =>
  events.reduce((sum, event) => sum + event.xp + event.bonusXp, 0);
