import { describe, expect, it } from 'vitest';
import { categories, concepts, choiceClassifications } from '../src/data/knowledge';
import { questions } from '../src/data/provider';
import { swipeCards, swipeCatalog } from '../src/data/swipe-provider';
import { emptyPlayer, submitAnswer, totalXp } from '../src/domain/game';
import { knowledgeProgress, reflectKnowledge } from '../src/domain/knowledgeProgress';
import { parsePlayer } from '../src/domain/storage';

describe('PR33 production classification', () => {
  it('uses four roots and option-specific drawers in both learning modes', () => {
    expect(categories.filter(c => !c.parentId).map(c => c.label)).toEqual([
      '人の健康と生活', '支援の考え方と方法', '支援の提供体制', '社会保障の仕組み',
    ]);
    expect(concepts).toHaveLength(1159);
    expect(categories.filter(c => c.parentId)).toHaveLength(487);
    expect(swipeCatalog.unclassified).toHaveLength(0);
    expect(questions.every(q => q.conceptIds.length && q.conceptIds.every(id => id.startsWith('drawer32.')))).toBe(true);
    for (const card of swipeCards) {
      const key = `${card.year}-${String(card.number).padStart(2, '0')}:${card.choiceId}`;
      const row = (choiceClassifications as Record<string, { drawerIds: string[] }>)[key];
      expect(card.topicIds).toEqual(row.drawerIds);
      expect(card.classificationRevision).toBe(4);
    }
    // Group-home wording must not override the knowledge needed to assess ADL.
    expect(swipeCards.find(c => c.id === '2005-53:2')!.topicIds[0]).toMatch(/^drawer32\.2\./);
    expect(swipeCards.some(c => c.topicIds.length > 1)).toBe(true);
    expect(swipeCards.some(c => c.classificationStatus === 'provisional')).toBe(true);
  });

  it('shows old saved answers in the new map, retains XP, and stores new reflections safely', () => {
    const q = questions[0];
    const oldQ = { ...q, conceptIds: ['old.category'], classificationRevision: 1 };
    let p = emptyPlayer();
    p.session = { id: 'old', questionIds: questions.slice(0, 5).map(q => q.id), index: 0, selectedIds: q.answerIds, completed: false };
    p = submitAnswer(p, [oldQ], '2026-10-11T00:00:00Z');
    p.concepts['old.category'].reflected = true;
    const saved = JSON.stringify(p), xp = totalXp(p);
    const imported = parsePlayer(saved);
    expect(imported).toEqual(p);
    const projected = knowledgeProgress(imported, questions);
    for (const id of q.conceptIds) {
      expect(projected[id]).toEqual({ seenQuestionIds: [q.id], correctQuestionIds: [q.id], reflected: false });
    }
    const reflected = reflectKnowledge(imported, q.conceptIds, questions);
    expect(parsePlayer(JSON.stringify(reflected))).toEqual(reflected);
    expect(totalXp(reflected)).toBe(xp);
    expect(reflected.attempts).toEqual(imported.attempts);
    expect(q.conceptIds.every(id => knowledgeProgress(reflected, questions)[id].reflected)).toBe(true);
    // Removed drawers remain inert archival evidence rather than breaking a later import.
    const retired = { ...reflected, knowledgeReflections: ['drawer32.1.retired#symptoms'] };
    expect(parsePlayer(JSON.stringify(retired))).toEqual(retired);
    expect(() => parsePlayer(JSON.stringify({ ...reflected, knowledgeReflections: ['unknown'] }))).toThrow();
  });
});
