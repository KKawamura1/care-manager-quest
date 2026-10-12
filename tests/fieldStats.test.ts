import { describe, expect, it } from 'vitest';
import { fieldStats } from '../src/domain/fieldStats';
import { buildStudyScope } from '../src/domain/studyScope';
import { swipeCards } from '../src/data/swipe-provider';
import type { LearningEvent } from '../src/domain/models';

const scope = buildStudyScope([
  { id: 'root', label: 'Root', description: '', available: true },
  { id: 'middle', parentId: 'root', label: 'Middle', description: '', available: true },
  { id: 'other', label: 'Other', description: '', available: true },
], ['a', 'b'].map(id => ({ id, categoryId: 'middle', label: id, summary: '', relatedIds: [] })));
const cards = swipeCards.slice(0, 6).map(card => ({ ...card, topicIds: ['a', 'b'] }));
function event(index: number, day: number, correct: boolean | null, mode: LearningEvent['mode'] = 'swipe'): LearningEvent {
  const card = cards[index];
  return { cardId: card.id, revision: card.revision, answer: correct === null ? null : correct ? card.truth : !card.truth, at: `2026-10-${String(day).padStart(2, '0')}T10:00:00+09:00`, mode, xp: 0, bonusXp: 0 };
}

describe('field learning statistics', () => {
  it('does not interpret untouched cards as wrong or strong', () => {
    const stats = fieldStats(cards, [], scope);
    expect(stats.get('all')).toMatchObject({ totalCards: 6, studiedCards: 0, accuracy: null, recentAccuracy: null, status: 'unseen' });
    expect(stats.get('other')).toMatchObject({ totalCards: 0, coverage: 0, accuracy: null });
    expect(fieldStats(cards, [event(0, 1, true)], scope).get('all')).toMatchObject({ accuracy: 1, coverage: 1 / 6, status: 'insufficient' });
  });
  it('deduplicates shared ancestors, daily repeats across modes, and excludes stale and removed cards', () => {
    const first = event(0, 1, false);
    const retry = { ...event(0, 1, true, 'five-choice'), at: '2026-10-01T11:00:00+09:00' };
    const events = [retry, event(0, 2, null), first, { ...event(1, 1, true), revision: 'old' }, { ...event(1, 2, true), cardId: 'retired' }];
    const stats = fieldStats(cards, events, scope);
    for (const id of ['all', 'root', 'middle', 'a', 'b']) {
      expect(stats.get(id)).toMatchObject({ totalCards: 6, studiedCards: 1, answers: 2, correct: 0, accuracy: 0 });
    }
  });
  it('uses JST midnight for first-daily evaluation', () => {
    const events = [
      { ...event(0, 1, false), at: '2026-10-01T14:59:59Z' },
      { ...event(0, 2, true), at: '2026-10-01T15:00:00Z' },
      { ...event(0, 2, false), at: '2026-10-01T15:01:00Z' },
    ];
    expect(fieldStats(cards, events, scope).get('all')).toMatchObject({ answers: 2, correct: 1, accuracy: .5 });
  });
  it('weights each studied card equally and limits recent accuracy to five daily answers per card', () => {
    const events = Array.from({ length: 10 }, (_, index) => event(0, index + 1, index >= 5));
    events.push(event(1, 1, false));
    expect(fieldStats(cards, events, scope).get('all')).toMatchObject({ accuracy: 5 / 11, recentAccuracy: .5, studiedCards: 2, status: 'insufficient' });
  });
  it('requires both enough answers and distinct cards, with 80% and 60% boundaries', () => {
    const ten = Array.from({ length: 10 }, (_, index) => event(index % 5, index < 5 ? 1 : 2, true));
    expect(fieldStats(cards, ten, scope).get('all')!.status).toBe('strong');
    ten[0] = event(0, 1, false); ten[1] = event(1, 1, false);
    expect(fieldStats(cards, ten, scope).get('all')).toMatchObject({ recentAccuracy: .8, status: 'strong' });
    ten[2] = event(2, 1, false); ten[3] = event(3, 1, false);
    expect(fieldStats(cards, ten, scope).get('all')).toMatchObject({ recentAccuracy: .6, status: 'developing' });
    ten[4] = event(4, 1, false);
    expect(fieldStats(cards, ten, scope).get('all')!.status).toBe('weak');
    const repeated = Array.from({ length: 10 }, (_, index) => event(0, index + 1, true));
    expect(fieldStats(cards, repeated, scope).get('all')!.status).toBe('insufficient');
  });
});
