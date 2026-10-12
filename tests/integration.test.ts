import { describe, expect, it } from 'vitest';
import { availableYears, historyQuestions, questions } from '../src/data/provider';
import { advance, emptyPlayer, reflect, submitAnswer, totalXp } from '../src/domain/game';
import { filterQuestions, parseYearFilter } from '../src/domain/questionFilter';
import { loadPlayer, parsePlayer, savePlayer } from '../src/domain/storage';

function completedCorpus() {
  let player = emptyPlayer();
  for (let offset = 0; offset < questions.length; offset += 5) {
    const batch = questions.slice(offset, offset + 5);
    player.session = {
      id: `corpus-${offset}`, index: 0, selectedIds: [], completed: false,
      questionIds: [...batch.map(q => q.id), ...questions.slice(0, 5 - batch.length).map(q => q.id)],
    };
    for (const question of batch) {
      player.session!.selectedIds = [...question.answerIds];
      player = advance(submitAnswer(player, questions, '2026-10-11T00:00:00.000Z'));
    }
  }
  return reflect(player, Object.keys(player.concepts));
}

describe('merged 2005–2025 corpus and portable history', () => {
  it('exposes exactly 1259 unique questions across all 21 years and excludes only the cancelled question', () => {
    expect(questions).toHaveLength(1259);
    expect(new Set(questions.map(q => q.id)).size).toBe(1259);
    expect(availableYears).toEqual(Array.from({ length: 21 }, (_, i) => 2025 - i));
    expect(questions.some(q => q.id === '2005-28')).toBe(false);
    expect(questions.every(q => new Set(q.conceptIds).size === q.conceptIds.length)).toBe(true);
    for (const year of availableYears) {
      expect(parseYearFilter(String(year))).toBe(year);
      expect(filterQuestions(questions, year, 'all')).toHaveLength(year === 2005 ? 59 : 60);
      expect(filterQuestions(questions, year, '介護支援分野')).toHaveLength(25);
      expect(filterQuestions(questions, year, '保健医療サービスの知識等')).toHaveLength(year === 2005 ? 19 : 20);
      expect(filterQuestions(questions, year, '福祉サービスの知識等')).toHaveLength(15);
    }
  });

  it('roundtrips all 1259 answers and concept evidence exceeding 250 through JSON and saved browser storage', () => {
    const player = completedCorpus();
    expect(player.attempts).toHaveLength(1259);
    expect(player.attempts.every(a => a.correct)).toBe(true);
    expect(Object.keys(player.concepts).every(id => id.startsWith('drawer5.'))).toBe(true);
    player.knowledgeReflections=[Object.keys(player.concepts)[0]];
    const restored = parsePlayer(JSON.stringify(player));
    expect(restored).toEqual(player);
    expect(totalXp(restored)).toBe(totalXp(player));
    let saved = '';
    expect(savePlayer({ setItem: (_, value) => { saved = value; } }, player)).toBeUndefined();
    expect(loadPlayer({ getItem: () => saved })).toEqual({ player, migrated: false });

    // A historical broad-category snapshot remains importable after its catalog is removed.
    const archive = structuredClone(player);
    for (const a of archive.attempts) a.conceptIds = ['archive.community'];
    archive.concepts = { 'archive.community': { seenQuestionIds: questions.map(q => q.id), correctQuestionIds: questions.map(q => q.id), reflected: true } };
    expect(parsePlayer(JSON.stringify(archive))).toEqual(archive);

    // A larger valid evidence list must not weaken duplicate, unsupported-ID, or length checks.
    for (const invalidId of ['unsupported-question', archive.concepts['archive.community'].seenQuestionIds[0]]) {
      const invalid = structuredClone(archive);
      invalid.concepts['archive.community'].seenQuestionIds.push(invalidId);
      expect(() => parsePlayer(JSON.stringify(invalid))).toThrow();
    }
    const oversized = structuredClone(archive);
    oversized.concepts['archive.community'].seenQuestionIds = Array.from({ length: historyQuestions.length + 1 }, (_, i) => `invalid-${i}`);
    expect(() => parsePlayer(JSON.stringify(oversized))).toThrow();
  }, 30000);
});
