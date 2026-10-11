import { describe, expect, it } from 'vitest';
import { questions } from '../src/data/provider';
import { swipeCards, swipeCatalog, swipeCardById, swipeConcepts } from '../src/data/swipe-provider';
import { buildSwipeCards, emptySwipe, filterSwipeCards, nextSwipeAvailableAt, progressFor, recordSwipe, reviewQueue, type TruthRecord, type TopicRecord } from '../src/domain/swipe';
import { loadSwipe, parseSwipe, SWIPE_STORAGE_KEY } from '../src/domain/swipeStorage';
import { emptyPlayer, totalXp } from '../src/domain/game';
import { parsePlayer } from '../src/domain/storage';
import type { Question } from '../src/domain/models';

const now = Date.parse('2026-10-11T00:00:00Z');
const question: Question = { ...questions[0], id: 'fixture', original: { ...questions[0].original!, year: 2025, number: 1 }, answerIds: ['1', '2'], answerVariants: undefined };
const topics: Record<string, TopicRecord> = Object.fromEntries([1,2,3,4,5].map(i => [`2025-01:${i}`, { drawerIds: ['topic'], reviewed: false }]));
const truth: Record<string, TruthRecord> = { fixture: { mode: 'choice_correctness', correctChoiceTruth: 'true', choiceAnswers: ['○', '○', '×', '×', '×'] } };
const build = (t = truth, q = question, c = topics) => buildSwipeCards([q], t.fixture ? { '2025-01': t.fixture } : {}, c, new Set(['topic']));

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
  it('uses choice-level drawers, including provisional and multiple knowledge assignments', () => {
    const mixed = { ...topics, '2025-01:1': { drawerIds: ['topic', 'other'], reviewed: false }, '2025-01:2': { drawerIds: ['unknown'], reviewed: false } };
    const result = buildSwipeCards([question], { '2025-01': truth.fixture }, mixed, new Set(['topic', 'other']));
    expect(result.cards[0].topicIds).toEqual(['topic', 'other']);
    expect(result.cards[0].classificationStatus).toBe('provisional');
    expect(filterSwipeCards(result.cards, 'all', 'other').map(c => c.choiceId)).toEqual(['1']);
    expect(result.unclassified.map(c => c.choiceId)).toEqual(['2']);
    expect(build(truth, question, {}).cards.every(c => !c.topicIds.length)).toBe(true);
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
    expect(filterSwipeCards(swipeCards, 'all', topicId).every(c => c.topicIds.includes(topicId))).toBe(true);
    console.info('Swipe catalog:', { cards: swipeCards.length, grouped: swipeCards.filter(c => c.topicId).length, pending: swipeCatalog.unclassified.length, excluded: swipeCatalog.excluded });
  });
});

describe('recall scheduling and isolated storage', () => {
  const day = 86_400_000;
  // Different original exam questions, rather than five sibling choices.
  const distinct = [...new Map(swipeCards.map(card => [card.questionId, card])).values()];
  const [a, b, c, d] = distinct;

  it('defers mistakes and unknown answers for a full day and spaces correct recalls by mastery', () => {
    let state = recordSwipe(emptySwipe(), a, !a.truth, now);
    expect(Date.parse(state.progress[a.id].dueAt) - now).toBe(day);
    expect(reviewQueue([a], state, now + day - 1)).toHaveLength(0);
    expect(reviewQueue([a], state, now + day)).toHaveLength(1);
    for (const [i, days] of [1, 3, 7, 14, 30, 60, 60].entries()) {
      state = recordSwipe(state, a, a.truth, now + (i + 1) * day);
      const p = state.progress[a.id];
      expect(Date.parse(p.dueAt) - Date.parse(p.lastReviewedAt)).toBe(days * day);
    }
    state = recordSwipe(state, a, !a.truth, now + 9 * day);
    expect(state.progress[a.id].streak).toBe(0);
    expect(state.progress[a.id].lapses).toBe(2);
    expect(Date.parse(state.progress[a.id].dueAt) - Date.parse(state.progress[a.id].lastReviewedAt)).toBe(day);
  });

  it('blocks every sibling choice of an answered original question for 24 hours, even under a different filter', () => {
    const siblings = swipeCards.filter(card => card.questionId === a.questionId);
    expect(siblings.length).toBeGreaterThan(1);
    const state = recordSwipe(emptySwipe(), a, !a.truth, now);
    expect(reviewQueue(siblings, state, now + day - 1)).toHaveLength(0);
    expect(reviewQueue([siblings.find(card => card.id !== a.id)!], state, now + day - 1)).toHaveLength(0);
    expect(nextSwipeAvailableAt(siblings, state, now)).toBe(now + day);
    expect(reviewQueue(siblings, state, now + day)).toHaveLength(siblings.length);
    expect(reviewQueue([b, ...siblings], state, now).map(card => card.id)).toEqual([b.id]);
  });

  it('respects a 24-hour question cooldown for records written by the old one-minute scheduler', () => {
    const old = recordSwipe(emptySwipe(), a, !a.truth, now);
    old.progress[a.id].dueAt = new Date(now + 60_000).toISOString();
    expect(reviewQueue([a], old, now + 60_000)).toHaveLength(0);
    expect(reviewQueue([a], old, now + day)).toHaveLength(1);
    expect(nextSwipeAvailableAt([a], old, now + 60_000)).toBe(now + day);
  });

  it('uses a 70:20:10 weighted draw for new, overdue mistake, and overdue success cards', () => {
    let state = recordSwipe(emptySwipe(), a, !a.truth, now - 2 * day);
    state = recordSwipe(state, b, b.truth, now - 2 * day);
    const cards = [a, b, c];
    // Each group has one card, so the injected random value selects only the group.
    expect(reviewQueue(cards, state, now, () => 0.1)[0].id).toBe(c.id);
    expect(reviewQueue(cards, state, now, () => 0.75)[0].id).toBe(a.id);
    expect(reviewQueue(cards, state, now, () => 0.95)[0].id).toBe(b.id);
    expect(reviewQueue([a, b], state, now, () => 0.1)[0].id).toBe(a.id);
    expect(reviewQueue([a, b], state, now, () => 0.9)[0].id).toBe(b.id);
    expect(reviewQueue([c], state, now).map(card => card.id)).toEqual([c.id]);
  });

  it('shuffles without duplicates or input mutation, and suppresses recently answered questions', () => {
    const [a, b, c, d, ...unseen] = distinct.slice(0, 34);
    let state = recordSwipe(emptySwipe(), a, !a.truth, now - day);
    state = recordSwipe(state, b, !b.truth, now - day);
    state = recordSwipe(state, c, c.truth, now - 2 * day);
    state = recordSwipe(state, d, d.truth, now - 2 * day);
    const input = [...unseen, d, b, a, c];
    const original = input.map(card => card.id);
    const first = reviewQueue(input, state, now, () => 0);
    const second = reviewQueue(input, state, now, () => 0.999999);
    expect(first.map(card => card.id)).not.toEqual(second.map(card => card.id));
    for (const result of [first, second]) {
      expect(new Set(result.map(card => card.id))).toEqual(new Set(original));
      expect(result).toHaveLength(input.length);
    }
    expect(input.map(card => card.id)).toEqual(original);
    let updated = state;
    const selected = first.slice(0, 20);
    for (const card of selected) updated = recordSwipe(updated, card, card.truth, now);
    const next = reviewQueue(input, updated, now);
    const answeredQuestions = new Set(selected.map(card => card.questionId));
    expect(next.every(card => !answeredQuestions.has(card.questionId))).toBe(true);
  });

  it('keeps the cooldown even if the truth revision changes, and computes the actual next available time', () => {
    const state = recordSwipe(emptySwipe(), a, a.truth, now);
    const changed = { ...a, truth: !a.truth, revision: `${a.questionVersion}:${a.truth ? '×' : '○'}` };
    expect(progressFor(state, changed)).toBeUndefined();
    expect(reviewQueue([changed], state, now)).toHaveLength(0);
    expect(nextSwipeAvailableAt([changed], state, now)).toBe(now + day);
    expect(reviewQueue([changed], state, now + day)).toHaveLength(1);
    const next = recordSwipe(state, changed, changed.truth, now + day);
    expect(next.progress[a.id].reviews).toBe(1);
    expect(parseSwipe(JSON.stringify(state), new Map([[changed.id, changed]]))).toEqual(state);
    expect(nextSwipeAvailableAt([], emptySwipe(), now)).toBeUndefined();

    const twice = recordSwipe(recordSwipe(emptySwipe(), b, b.truth, now), b, b.truth, now + day);
    expect(nextSwipeAvailableAt([b], twice, now + day)).toBe(now + 4 * day);
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

  it('records unknown as a mistake and roundtrips both new and prior boolean answers', () => {
    for (const truth of [true, false]) {
      const card = { ...a, truth, revision: `${a.questionVersion}:${truth ? '○' : '×'}` };
      const map = new Map([[card.id, card]]);
      const success = recordSwipe(emptySwipe(), card, truth, now);
      expect(parseSwipe(JSON.stringify(success), map)).toEqual(success);
      const unknown = recordSwipe(success, card, null, now + 1);
      expect(unknown.progress[card.id]).toMatchObject({ reviews: 2, correct: 1, lapses: 1, streak: 0, lastCorrect: false, lastAnswer: null });
      expect(Date.parse(unknown.progress[card.id].dueAt) - Date.parse(unknown.progress[card.id].lastReviewedAt)).toBe(day);
      expect(parseSwipe(JSON.stringify(unknown), map)).toEqual(unknown);
      expect(reviewQueue([card], unknown, now + day + 2)).toHaveLength(1);
      const invalid = structuredClone(unknown); invalid.progress[card.id].lastCorrect = true;
      expect(() => parseSwipe(JSON.stringify(invalid), map)).toThrow();
    }
  });
});
