import type { LearningEvent } from './models';
import type { SwipeCard } from './swipe';
import type { StudyScope } from './studyScope';
import { firstDailyAnswers } from './learning';

const RECENT_ACCURACY_WINDOW = 5;

export interface FieldStats {
  totalCards: number;
  studiedCards: number;
  answers: number;
  correct: number;
  accuracy: number | null;
  recentAccuracy: number | null;
  coverage: number;
  status: 'unseen' | 'insufficient' | 'strong' | 'weak' | 'developing';
}
const empty = (): FieldStats => ({ totalCards: 0, studiedCards: 0, answers: 0, correct: 0, accuracy: null, recentAccuracy: null, coverage: 0, status: 'unseen' });

/** Current revisions only, first answer per JST day shared across both modes.
 * Each card contributes once per ancestor even when several drawers match.
 * Recent accuracy uses each studied card's latest five daily answers, equally
 * weighting cards so repeatedly practicing one card cannot dominate a field.
 */
export function fieldStats(cards: readonly SwipeCard[], events: readonly LearningEvent[], scope: StudyScope): Map<string, FieldStats> {
  const result = new Map<string, FieldStats>([['all', empty()]]);
  for (const node of [...scope.categories, ...scope.concepts]) result.set(node.id, empty());
  const byCard = new Map<string, LearningEvent[]>();
  for (const event of firstDailyAnswers([...events].sort((a, b) => Date.parse(a.at) - Date.parse(b.at)))) {
    const entries = byCard.get(event.cardId) ?? [];
    entries.push(event); byCard.set(event.cardId, entries);
  }
  const recentTotals = new Map<string, number>();
  for (const card of cards) {
    const daily = (byCard.get(card.id) ?? []).filter(event => event.revision === card.revision);
    const correct = daily.filter(event => event.answer !== null && event.answer === card.truth).length;
    const recent = daily.slice(-RECENT_ACCURACY_WINDOW);
    const recentRate = recent.length ? recent.filter(event => event.answer !== null && event.answer === card.truth).length / recent.length : 0;
    const ids = new Set(['all', ...card.topicIds.flatMap(id => scope.path(id))]);
    for (const id of ids) {
      const stats = result.get(id)!;
      stats.totalCards++;
      stats.studiedCards += daily.length ? 1 : 0;
      stats.answers += daily.length; stats.correct += correct;
      recentTotals.set(id, (recentTotals.get(id) ?? 0) + recentRate);
    }
  }
  for (const [id, stats] of result) {
    stats.accuracy = stats.answers ? stats.correct / stats.answers : null;
    stats.recentAccuracy = stats.studiedCards ? (recentTotals.get(id) ?? 0) / stats.studiedCards : null;
    stats.coverage = stats.totalCards ? stats.studiedCards / stats.totalCards : 0;
    stats.status = !stats.answers ? 'unseen' : stats.answers < 10 || stats.studiedCards < 5 ? 'insufficient' :
      stats.recentAccuracy! >= .8 ? 'strong' : stats.recentAccuracy! < .6 ? 'weak' : 'developing';
  }
  return result;
}
