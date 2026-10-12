import { describe, expect, it } from 'vitest';
import { dailyProgress } from '../src/domain/dailyProgress';
import type { LearningEvent } from '../src/domain/models';

const event = (at: string, overrides: Partial<LearningEvent> = {}): LearningEvent => ({
  cardId: 'card-1', revision: '1:○', answer: true, mode: 'swipe', xp: 10, bonusXp: 0, at, ...overrides,
});
const now = Date.parse('2026-10-13T03:00:00Z');

describe('daily learning progress', () => {
  it('fills every calendar day, carries older XP, and includes both modes and bonus', () => {
    const result = dailyProgress([
      event('2026-10-10T01:00:00Z', { mode: 'five-choice', bonusXp: 20 }),
      event('2026-10-01T01:00:00Z'),
      event('2026-10-10T02:00:00Z', { cardId: 'card-2', xp: 2 }),
    ], 7, now);
    expect(result.openingXp).toBe(10);
    expect(result.days.map(day => day.day)).toEqual(['2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11', '2026-10-12', '2026-10-13']);
    expect(result.days.map(day => day.cumulativeXp)).toEqual([10, 10, 10, 42, 42, 42, 42]);
    expect(result.days[3]).toMatchObject({ questXp: 30, swipeXp: 2, xp: 32, answers: 2 });
    expect(result).toMatchObject({ totalXp: 42, periodXp: 32, activeDays: 1, streak: 0 });
  });
  it('uses midnight in Japan and keeps same-day practice out of measured answers', () => {
    const result = dailyProgress([
      event('2026-10-11T14:59:59Z'),
      event('2026-10-11T15:00:00Z'),
      event('2026-10-12T02:00:00Z', { xp: 0 }),
      event('2026-10-12T15:00:00Z'),
    ], 7, now);
    expect(result.days.slice(-3).map(day => [day.xp, day.answers])).toEqual([[10, 1], [10, 1], [10, 1]]);
    expect(result.streak).toBe(3);
  });
  it('lets yesterday keep the streak alive, but a missed day breaks it', () => {
    const events = [event('2026-10-10T20:00:00Z'), event('2026-10-11T20:00:00Z')];
    expect(dailyProgress(events, 7, now).streak).toBe(2);
    expect(dailyProgress(events, 7, now + 86_400_000).streak).toBe(0);
  });
  it('counts streaks longer than the selected period and retains rewards for retired revisions', () => {
    const events = Array.from({ length: 40 }, (_, i) => event(new Date(now - i * 86_400_000).toISOString(), { revision: 'old-revision' }));
    const result = dailyProgress(events, 7, now);
    expect(result).toMatchObject({ streak: 40, activeDays: 7, totalXp: 400, periodXp: 70, openingXp: 330 });
  });
  it('shows honest zeros for empty history and excludes future events', () => {
    const result = dailyProgress([event('2026-10-13T04:00:00Z'), event('2026-10-14T01:00:00Z')], 90, now);
    expect(result.days).toHaveLength(90);
    expect(result).toMatchObject({ totalXp: 0, periodXp: 0, streak: 0, activeDays: 0 });
    expect(result.days.every(day => day.xp === 0 && day.answers === 0)).toBe(true);
  });
});
