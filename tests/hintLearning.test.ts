import { describe, expect, it } from 'vitest';
import { swipeCards, swipeCardById } from '../src/data/swipe-provider';
import { questions } from '../src/data/provider';
import { studyScope } from '../src/data/study-scope';
import { emptyPlayer } from '../src/domain/game';
import { learningCorrect, learningLevel, recordLearning, swipeProgressFromEvents } from '../src/domain/learning';
import { fieldStats } from '../src/domain/fieldStats';
import { knowledgeProgress } from '../src/domain/knowledgeProgress';
import { parsePlayer } from '../src/domain/storage';

const card = swipeCards[0];
const at = '2026-10-17T09:00:00+09:00';
describe('answers after viewing a glossary hint', () => {
  it.each([true, false, null])('preserves answer %s but scores it as a failure in every projection and after import', answer => {
    const events = recordLearning([], [{card, answer, hintUsed:true}], at, 'swipe');
    expect(events[0]).toMatchObject({answer, hintUsed:true, xp:2, bonusXp:0});
    expect(learningCorrect(events[0],card)).toBe(false);
    expect(learningLevel(events,card)).toBe(0);
    expect(swipeProgressFromEvents(events,swipeCardById).progress[card.id]).toMatchObject({lastCorrect:false,correct:0,streak:0});
    expect(fieldStats(swipeCards,events,studyScope).get('all')).toMatchObject({answers:1,correct:0,accuracy:0,recentAccuracy:0});
    const player = {...emptyPlayer(), learningEvents:events};
    const mapped = knowledgeProgress(player,questions,Date.parse(at));
    for (const id of card.topicIds) {
      expect(mapped[id].seenQuestionIds).toContain(card.id);
      expect(mapped[id].correctQuestionIds).not.toContain(card.id);
      expect(mapped[id].level).toBe(0);
    }
    const imported = parsePlayer(JSON.stringify(player));
    expect(imported.learningEvents).toEqual(events);
    expect(learningLevel(imported.learningEvents,card)).toBe(0);
  });
  it('does not erase a hinted failure with same-day practice, but allows later unaided learning', () => {
    let events = recordLearning([], [{card,answer:card.truth,hintUsed:true}],at,'swipe');
    events = recordLearning(events,[{card,answer:card.truth}], '2026-10-17T10:00:00+09:00','swipe');
    expect(events[1]).not.toHaveProperty('hintUsed');
    expect(events[1].xp).toBe(0);
    expect(learningLevel(events,card)).toBe(0);
    events = recordLearning(events,[{card,answer:card.truth}], '2026-10-18T09:00:00+09:00','swipe');
    expect(learningLevel(events,card)).toBeCloseTo(2/3);
  });
  it('preserves existing unassisted histories and validates hint metadata', () => {
    const events = recordLearning([], [{card,answer:card.truth}],at,'swipe');
    const player = {...emptyPlayer(),learningEvents:events};
    expect(parsePlayer(JSON.stringify(player))).toEqual(player);
    expect(learningLevel(events,card)).toBeCloseTo(2/3);
    expect(() => parsePlayer(JSON.stringify({...player,learningEvents:[{...events[0],hintUsed:'yes'}]}))).toThrow();
  });
});
