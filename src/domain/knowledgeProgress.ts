import type { ConceptProgress, PlayerState, Question } from './models';
import { swipeCards } from '../data/swipe-provider';
import { firstDailyAnswers, learningLevel, reviewUrgency } from './learning';
import { reflect } from './game';

/** Include unlearned drawers so a category reflects its entire knowledge scope. */
export function aggregateKnowledgeLevel(ids: readonly string[], progress: Record<string, ConceptProgress>): number {
  return ids.length ? ids.reduce((sum, id) => sum + (progress[id]?.level ?? 0), 0) / ids.length : 0;
}

/** Project all current choice cards onto their knowledge drawers. */
export function knowledgeProgress(player: PlayerState, _questions: readonly Question[], now = Date.now()) {
  const progress: Record<string, ConceptProgress> = {};
  const totals = new Map<string, { count: number; level: number; due: number }>();
  const byCard = new Map<string, typeof player.learningEvents>();
  for (const event of player.learningEvents) {
    const entries = byCard.get(event.cardId) ?? [];
    entries.push(event);
    byCard.set(event.cardId, entries);
  }
  for (const card of swipeCards) {
    const answers = byCard.get(card.id) ?? [];
    const daily = firstDailyAnswers(answers, card);
    const level = learningLevel(answers, card);
    const due = daily.length > 0 && reviewUrgency(answers, card, now) >= 1 ? 1 : 0;
    for (const id of card.topicIds) {
      const sum = totals.get(id) ?? { count: 0, level: 0, due: 0 };
      sum.count++;
      sum.level += level;
      sum.due += due;
      totals.set(id, sum);
      if (!daily.length) continue;
      const p = progress[id] ??= { seenQuestionIds: [], correctQuestionIds: [], reflected: false };
      p.seenQuestionIds.push(card.id);
      if (daily.some(event => event.answer !== null && event.answer === card.truth)) p.correctQuestionIds.push(card.id);
    }
  }
  for (const [id, sum] of totals) {
    const p = progress[id] ??= { seenQuestionIds: [], correctQuestionIds: [], reflected: false };
    p.level = sum.level / sum.count;
    p.review = sum.due / sum.count;
  }
  return progress;
}
export function reflectKnowledge(player: PlayerState, ids: string[], questions: readonly Question[]): PlayerState {
  const progress = knowledgeProgress(player, questions);
  const learned = ids.filter(id => progress[id]?.seenQuestionIds.length);
  return { ...reflect(player, learned), knowledgeReflections: [...new Set([...(player.knowledgeReflections ?? []), ...learned])] };
}
