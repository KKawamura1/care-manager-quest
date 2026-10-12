import { firstDailyAnswers, learningDay } from './learning';
import type { LearningEvent } from './models';

export type ProgressPeriod = 7 | 30 | 90;
export interface ProgressDay {
  day: string; swipeXp: number; questXp: number; xp: number; cumulativeXp: number; answers: number;
}
const DAY = 86_400_000;
export const offsetDay = (day: string, offset: number) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + offset * DAY).toISOString().slice(0, 10);

/** Earned XP is historical effort: truth revisions never erase past rewards. */
export function dailyProgress(events: readonly LearningEvent[], period: ProgressPeriod, now = Date.now()) {
  const today = learningDay(new Date(now).toISOString());
  const start = offsetDay(today, 1 - period);
  const eligible = events.filter(event => Date.parse(event.at) <= now);
  const byDay = new Map<string, ProgressDay>();
  for (const event of eligible) {
    const day = learningDay(event.at);
    const row = byDay.get(day) ?? { day, swipeXp: 0, questXp: 0, xp: 0, cumulativeXp: 0, answers: 0 };
    const xp = event.xp + event.bonusXp;
    row.xp += xp;
    if (event.mode === 'swipe') row.swipeXp += xp;
    else row.questXp += xp;
    byDay.set(day, row);
  }
  for (const event of firstDailyAnswers(eligible)) byDay.get(learningDay(event.at))!.answers++;
  let cumulativeXp = 0;
  for (const row of byDay.values()) if (row.day < start) cumulativeXp += row.xp;
  const openingXp = cumulativeXp;
  const days = Array.from({ length: period }, (_, i) => {
    const day = offsetDay(start, i);
    const row = byDay.get(day) ?? { day, swipeXp: 0, questXp: 0, xp: 0, cumulativeXp: 0, answers: 0 };
    cumulativeXp += row.xp;
    return { ...row, cumulativeXp };
  });
  // Yesterday keeps a streak alive until the learner has had a chance to study today.
  let streak = 0;
  let cursor = byDay.has(today) ? today : offsetDay(today, -1);
  while (byDay.has(cursor)) { streak++; cursor = offsetDay(cursor, -1); }
  return {
    days, openingXp, totalXp: cumulativeXp, periodXp: cumulativeXp - openingXp, streak,
    activeDays: days.filter(day => byDay.has(day.day)).length,
  };
}
