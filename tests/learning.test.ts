import { describe, expect, it } from 'vitest';
import { swipeCards, swipeCardById } from '../src/data/swipe-provider';
import { firstDailyAnswers, learningDay, learningLevel, learningXp, recordLearning, reviewIntervalDays, reviewUrgency, swipeProgressFromEvents } from '../src/domain/learning';
const [a,b,c,d,e] = swipeCards;
const onDay = (day: number) => `2026-10-${String(day).padStart(2,'0')}T10:00:00.000+09:00`;

describe('single shared choice evaluation', () => {
  it('uses JST midnight, not UTC midnight', () => {
    expect(learningDay('2026-10-11T14:59:59.000Z')).toBe('2026-10-11');
    expect(learningDay('2026-10-11T15:00:00.000Z')).toBe('2026-10-12');
  });

  it('counts only the first answer per card per Japanese calendar day across both modes', () => {
    let events = recordLearning([], [{card:a,answer:!a.truth}], onDay(11),'swipe');
    events = recordLearning(events,[{card:a,answer:a.truth}],onDay(11).replace('10:00:00','12:00:00'),'five-choice');
    expect(events.map(e=>e.xp)).toEqual([2,0]);
    expect(firstDailyAnswers(events,a)).toHaveLength(1);
    expect(learningLevel(events,a)).toBe(0);
    events = recordLearning(events,[{card:a,answer:a.truth}],onDay(12),'swipe');
    expect(events[2].xp).toBe(10);
    expect(firstDailyAnswers(events,a)).toHaveLength(2);
    expect(learningLevel(events,a)).toBeCloseTo(2/3);
    expect(learningXp(events)).toBe(12);
  });

  it('reaches full mastery with two consecutive correct daily first answers', () => {
    expect(learningLevel([],a)).toBe(0);
    let events = recordLearning([], [{card:a,answer:a.truth}],onDay(11),'swipe');
    expect(learningLevel(events,a)).toBeCloseTo(2/3);
    events = recordLearning(events,[{card:a,answer:a.truth}],onDay(12),'five-choice');
    expect(learningLevel(events,a)).toBe(1);
    const scheduling = swipeProgressFromEvents(events,swipeCardById);
    expect(Date.parse(scheduling.progress[a.id].dueAt)-Date.parse(onDay(12))).toBe(14*86_400_000);
    events = recordLearning(events,[{card:a,answer:!a.truth}],onDay(13),'swipe');
    expect(learningLevel(events,a)).toBeCloseTo(1/3);
    events = recordLearning(events,[{card:a,answer:a.truth}],onDay(14),'swipe');
    expect(learningLevel(events,a)).toBeCloseTo(2/3);
    events = recordLearning(events,[{card:a,answer:a.truth}],onDay(16),'swipe');
    expect(learningLevel(events,a)).toBe(1);
  });

  it('does not count same-day practice as the second consecutive correct answer', () => {
    let events = recordLearning([], [{card:a,answer:a.truth}],onDay(11),'swipe');
    events = recordLearning(events,[{card:a,answer:a.truth}],onDay(11).replace('10:00:00','12:00:00'),'five-choice');
    expect(learningLevel(events,a)).toBeCloseTo(2/3);
    events = recordLearning(events,[{card:a,answer:a.truth}],onDay(12),'swipe');
    expect(learningLevel(events,a)).toBe(1);
  });

  it('treats an unknown answer as a failure and recalculates existing histories', () => {
    let events = recordLearning([], [{card:a,answer:a.truth}],onDay(11),'swipe');
    events = recordLearning(events,[{card:a,answer:null}],onDay(12),'swipe');
    expect(learningLevel(events,a)).toBeCloseTo(1/3);
    events = recordLearning(events,[{card:a,answer:a.truth}],onDay(13),'swipe');
    expect(learningLevel(events,a)).toBeCloseTo(2/3);
    events = recordLearning(events,[{card:a,answer:a.truth}],onDay(14),'swipe');
    expect(learningLevel(JSON.parse(JSON.stringify(events)),a)).toBe(1);
  });

  it('records all five choices of a complete 5-choice answer, awarding bonus once', () => {
    const cards = [a,b,c,d,e];
    const choices = cards.map(card=>({card,answer:card.truth}));
    const events = recordLearning([],choices,onDay(11),'five-choice',true);
    expect(events).toHaveLength(5);
    expect(events.every(e=>e.mode==='five-choice')).toBe(true);
    expect(learningXp(events)).toBe(70);
    const again = recordLearning(events,choices,onDay(11),'five-choice',true);
    expect(learningXp(again)).toBe(70);
    const cross = recordLearning(recordLearning([], [{card:a,answer:a.truth}], onDay(11), 'swipe'),choices,onDay(11),'five-choice',true);
    expect(learningXp(cross)).toBe(50);
  });

  it('review urgency rises with time without reducing the accumulated level', () => {
    const events=recordLearning([],[{card:a,answer:a.truth}],onDay(11),'swipe');
    const start=Date.parse(onDay(11));
    expect(reviewIntervalDays(learningLevel(events,a))).toBe(7);
    expect(reviewUrgency(events,a,start+86_400_000)).toBeCloseTo(1/7);
    expect(reviewUrgency(events,a,start+8*86_400_000)).toBeGreaterThan(1);
    expect(learningLevel(events,a)).toBeCloseTo(2/3);
    const scheduling=swipeProgressFromEvents(events,swipeCardById);
    expect(Date.parse(scheduling.progress[a.id].dueAt)-start).toBe(7*86_400_000);
  });
});

describe('revision preservation', () => {
  it('does not transfer mastery to a revised truth label', () => {
    const events=recordLearning([], [{card:a,answer:a.truth}],onDay(11),'swipe');
    const revised={...a, truth:!a.truth,revision:a.revision+':changed'};
    expect(learningLevel(events,revised)).toBe(0);
    expect(learningLevel(events,a)).toBeCloseTo(2/3);
  });
});
