import { describe, expect, it } from 'vitest';
import { questions } from '../src/data/provider';
import { swipeCards, swipeCatalog, swipeCardById, swipeConcepts } from '../src/data/swipe-provider';
import { buildSwipeCards, emptySwipe, filterSwipeCards, progressFor, recordSwipe, reviewQueue, type TruthRecord, type TopicRecord } from '../src/domain/swipe';
import { loadSwipe, parseSwipe, SWIPE_STORAGE_KEY } from '../src/domain/swipeStorage';
import { emptyPlayer, totalXp } from '../src/domain/game';
import { parsePlayer } from '../src/domain/storage';
import type { Question } from '../src/domain/models';

const now = Date.parse('2026-10-11T00:00:00Z');
const question: Question = { ...questions[0], id: 'fixture', original: { ...questions[0].original!, year: 2025, number: 1 }, answerIds: ['1', '2'], answerVariants: undefined };
const topics: Record<string, TopicRecord> = { fixture: { primaryConceptId: 'topic', relatedConceptIds: [], status: 'provisional_topic_classified', classificationRevision: 3 } };
const truth: Record<string, TruthRecord> = { fixture: { mode: 'choice_correctness', correctChoiceTruth: 'true', choiceAnswers: ['○', '○', '×', '×', '×'] } };
const build = (t = truth, q = question, c = topics) => buildSwipeCards([q], t.fixture ? { '2025-01': t.fixture } : {}, c.fixture ? { '2025-01': c.fixture } : {}, new Set(['topic']));

describe('safe choice conversion', () => {
  it('uses explicit false-statement polarity, and never inverts merely because the stem contains a negative condition', () => {
    const inverted = { fixture: { ...truth.fixture, correctChoiceTruth: 'false', choiceAnswers: ['×', '×', '○', '○', '○'] } };
    expect(build(inverted, { ...question, stem: '正しくないものを選べ。2つ選べ。' }).cards.map(c => c.truth)).toEqual([false, false, true, true, true]);
    expect(build(truth, { ...question, stem: '被保険者とならないものはどれか。' }).cards.map(c => c.truth)).toEqual([true, true, false, false, false]);
  });
  it('rejects missing, cancelled, malformed and conflicting keys rather than silently guessing', () => {
    expect(build({}).cards).toHaveLength(0);
    expect(build({ fixture: { ...truth.fixture, mode: 'not_convertible' } }).cards).toHaveLength(0);
    expect(build({ fixture: { ...truth.fixture, correctChoiceTruth: 'unknown' } }).cards).toHaveLength(0);
    expect(build({ fixture: { ...truth.fixture, choiceAnswers: ['○'] } }).cards).toHaveLength(0);
    expect(build(truth, { ...question, stem: '' }).cards).toHaveLength(0);
    expect(build(truth, { ...question, options: question.options.map((o, i) => i === 0 ? { ...o, id: '2' } : o) }).cards).toHaveLength(0);
    const conflict = build({ fixture: { ...truth.fixture, choiceAnswers: ['×', '○', '×', '×', '×'] } });
    expect(conflict.cards).toHaveLength(4); expect(conflict.excluded[0].choiceId).toBe('1');
  });
  it('rejects only ambiguous choices across multiple accepted answer combinations', () => {
    const catalog = build(truth, { ...question, answerVariants: [['1', '2'], ['1', '3']] });
    expect(catalog.cards.map(c => c.choiceId)).toEqual(['1', '4', '5']);
    expect(catalog.excluded.map(i => i.choiceId)).toEqual(['2', '3']);
  });
  it('does not assign mixed, absent, invalid or review-pending knowledge categories', () => {
    for (const t of [{ ...topics.fixture, relatedConceptIds: ['other'] }, { ...topics.fixture, status: 'needs_option_level_review' }, { ...topics.fixture, primaryConceptId: 'unknown' }]) {
      const result = build(truth, question, { fixture: t });
      expect(result.cards).toHaveLength(5); expect(result.cards.every(c => !c.topicId)).toBe(true); expect(result.unclassified).toHaveLength(5);
    }
    expect(build().cards.every(c => c.topicId === 'topic')).toBe(true);
  });
  it('preserves original stems/options and accepts only variant-consistent registered truth throughout 2005–2025', () => {
    expect(new Set(swipeCards.map(c => c.id)).size).toBe(swipeCards.length);
    expect(swipeCards).toHaveLength(6289);
    expect(filterSwipeCards(swipeCards, 2020, 'all')).toHaveLength(300);
    expect(swipeCards.some(c => c.questionId === '2005-28')).toBe(false);
    const qmap = new Map(questions.map(q => [q.id, q]));
    for (const card of swipeCards) {
      const q = qmap.get(card.questionId)!;
      expect(card.stem).toBe(q.stem); expect(card.text).toBe(q.options.find(o => o.id === card.choiceId)!.text);
      for (const ids of q.answerVariants ?? [q.answerIds]) expect(card.truth).toBe(ids.includes(card.choiceId) === card.correctChoiceTruth);
      if (card.topicId) expect(swipeConcepts.some(c => c.id === card.topicId)).toBe(true);
    }
    expect(swipeCatalog.excluded.some(c => c.questionId === '2009-21')).toBe(true);
    expect(filterSwipeCards(swipeCards, 2025, 'all').every(c => c.year === 2025)).toBe(true);
    expect(filterSwipeCards(swipeCards, 'all', 'unclassified').every(c => !c.topicId)).toBe(true);
    const topicId = swipeCards.find(c => c.topicId)!.topicId!;
    expect(filterSwipeCards(swipeCards, 'all', topicId).every(c => c.topicId === topicId)).toBe(true);
    console.info('Swipe catalog:', { cards: swipeCards.length, grouped: swipeCards.filter(c => c.topicId).length, pending: swipeCatalog.unclassified.length, excluded: swipeCatalog.excluded });
  });
});

describe('recall scheduling and isolated storage', () => {
  const [a, b, c] = swipeCards;
  it('prioritizes due mistakes over due successes and unseen cards, and spaces recall by mastery', () => {
    let state = recordSwipe(emptySwipe(), a, !a.truth, now);
    state = recordSwipe(state, b, b.truth, now - 2 * 86_400_000);
    expect(reviewQueue([a, b, c], state, now).map(c => c.id)).toEqual([b.id, c.id]);
    expect(reviewQueue([c, b, a], state, now + 60_000).map(c => c.id)).toEqual([a.id, b.id, c.id]);
    for (const [i, days] of [1, 3, 7, 14, 30, 60, 60].entries()) {
      state = recordSwipe(state, a, a.truth, now + i * 86_400_000);
      const p = state.progress[a.id];
      expect(Date.parse(p.dueAt) - Date.parse(p.lastReviewedAt)).toBe(days * 86_400_000);
    }
    state = recordSwipe(state, a, !a.truth, now + 8 * 86_400_000);
    expect(state.progress[a.id].streak).toBe(0); expect(state.progress[a.id].lapses).toBe(2);
    expect(Date.parse(state.progress[a.id].dueAt) - Date.parse(state.progress[a.id].lastReviewedAt)).toBe(60_000);
  });
  it('resets mastery when a card truth changes while keeping archived evidence', () => {
    const state = recordSwipe(emptySwipe(), a, a.truth, now);
    const changed = { ...a, truth: !a.truth, revision: `${a.questionVersion}:${a.truth ? '×' : '○'}` };
    expect(progressFor(state, changed)).toBeUndefined();
    expect(reviewQueue([changed], state, now)).toHaveLength(1);
    const next = recordSwipe(state, changed, changed.truth, now);
    expect(next.progress[a.id].reviews).toBe(1);
    expect(parseSwipe(JSON.stringify(state), new Map([[changed.id, changed]]))).toEqual(state);
  });
  it('roundtrips the entire card corpus, validates counters/dates/identity, and leaves five-choice history untouched', () => {
    const state = emptySwipe();
    for (const card of swipeCards) state.progress[card.id] = recordSwipe(emptySwipe(), card, card.truth, now).progress[card.id];
    expect(parseSwipe(JSON.stringify(state), swipeCardById)).toEqual(state);
    const player = emptyPlayer(), rawPlayer = JSON.stringify(player);
    expect(parsePlayer(rawPlayer)).toEqual(player); expect(totalXp(player)).toBe(0);
    expect(SWIPE_STORAGE_KEY).not.toBe('care-manager-quest:v1');
    for (const patch of [{ reviews: -1 }, { correct: 2 }, { streak: 0 }, { dueAt: 'invalid' }, { lastCorrect: false }, { dueAt: state.progress[a.id].lastReviewedAt }]) {
      const invalid = { schemaVersion: 1, progress: { [a.id]: { ...state.progress[a.id], ...patch } } };
      expect(() => parseSwipe(JSON.stringify(invalid), swipeCardById)).toThrow();
    }
    expect(() => parseSwipe(JSON.stringify({ schemaVersion: 1, progress: { unknown: state.progress[a.id] } }), swipeCardById)).toThrow();
    expect(() => parseSwipe(rawPlayer, swipeCardById)).toThrow();
  });
  it('retains corrupt stored data for recovery and reports access errors', () => {
    const loaded = loadSwipe({ getItem: () => '{broken' }, swipeCardById);
    expect(loaded.raw).toBe('{broken'); expect(loaded.error).toBeTruthy(); expect(loaded.state).toEqual(emptySwipe());
    expect(loadSwipe({ getItem: () => { throw new Error('denied'); } }, swipeCardById).error).toBe('denied');
  });
  it('records unknown as a mistake independently of card truth, and roundtrips both new and prior boolean answers', () => {
    for (const truth of [true, false]) {
      const card = { ...a, truth, revision: `${a.questionVersion}:${truth ? '○' : '×'}` };
      const map = new Map([[card.id, card]]);
      const success = recordSwipe(emptySwipe(), card, truth, now);
      expect(parseSwipe(JSON.stringify(success), map)).toEqual(success);
      const unknown = recordSwipe(success, card, null, now + 1);
      expect(unknown.progress[card.id]).toMatchObject({ reviews: 2, correct: 1, lapses: 1, streak: 0, lastCorrect: false, lastAnswer: null });
      expect(Date.parse(unknown.progress[card.id].dueAt) - Date.parse(unknown.progress[card.id].lastReviewedAt)).toBe(60_000);
      expect(parseSwipe(JSON.stringify(unknown), map)).toEqual(unknown);
      expect(reviewQueue([card], unknown, now + 60_001)).toHaveLength(1);
      const invalid = structuredClone(unknown); invalid.progress[card.id].lastCorrect = true;
      expect(() => parseSwipe(JSON.stringify(invalid), map)).toThrow();
    }
  });
});
