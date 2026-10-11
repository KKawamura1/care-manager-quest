import { describe, expect, it } from 'vitest';
import { categories, concepts, choiceClassifications } from '../src/data/knowledge';
import { questions } from '../src/data/provider';
import { swipeCards, swipeCatalog } from '../src/data/swipe-provider';
import { emptyPlayer, submitAnswer, totalXp } from '../src/domain/game';
import { knowledgeProgress, reflectKnowledge } from '../src/domain/knowledgeProgress';
import { parsePlayer } from '../src/domain/storage';
import classificationManifest from '../docs/taxonomy/issue-32-experiment/manifest.json';

describe('PR33 production classification', () => {
  it('uses four roots and option-specific drawers in both learning modes', () => {
    expect(categories.filter(c => !c.parentId).map(c => c.label)).toEqual([
      '人の健康と生活', '支援の考え方と方法', '支援の提供体制', '社会保障の仕組み',
    ]);
    expect(concepts).toHaveLength(classificationManifest.normalization_summary.normalized_drawer_count);
    expect(categories.filter(c => c.parentId)).toHaveLength(classificationManifest.normalization_summary.concept_count);
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

  it('projects the 2025 judgment-knowledge reviews onto actual learning cards', () => {
    const reviewedCards = swipeCards.filter(c => c.year === 2025);
    expect(reviewedCards).toHaveLength(300);
    expect(reviewedCards.every(c => c.classificationStatus === 'reviewed')).toBe(true);
    const drawer = (number: number, choice: number) => reviewedCards.find(c => c.number === number && c.choiceId === String(choice))!.topicIds[0];
    expect(drawer(29, 2)).toBe('drawer32.3.3.1.preventive.day_rehab#eligibility');
    expect(drawer(25, 4)).toBe('drawer32.3.3.1.community.group_home#eligibility');
    expect(drawer(30, 5)).toBe('drawer32.4.4.1.benefits#applicable_services');
    expect(drawer(36, 5)).toBe('drawer32.1.1.1.diabetes#treatment');
    expect(drawer(42, 2)).toBe('drawer32.1.1.1.drug_adverse_effects#symptoms');
    expect(drawer(42, 3)).toBe('drawer32.3.3.3.care_worker#authority');
    expect(drawer(42, 5)).toBe('drawer32.1.1.1.drug_adverse_effects#risk');
    expect(drawer(41, 5)).toBe('drawer32.3.3.3.nurse#authority');
    expect(drawer(40, 4)).toBe('drawer32.2.2.4.acp#documentation');
    expect(drawer(44, 4)).toBe('drawer32.3.3.1.community.nursing_multi#care_plan');
    expect(drawer(50, 3)).toBe('drawer32.3.3.1.home.visiting_care#care_plan');
    expect(drawer(50, 3)).not.toBe(drawer(50, 5));
    // Assertion values share a knowledge drawer rather than creating five categories.
    expect(new Set([1, 2, 3, 4, 5].map(c => drawer(12, c))).size).toBe(1);
    expect(new Set([1, 2, 3, 4, 5].map(c => drawer(22, c))).size).toBe(1);
    expect(new Set([2, 3, 4].map(c => drawer(54, c))).size).toBe(1);
    expect(drawer(54, 1)).not.toBe(drawer(54, 2));
  });

  it('uses judgment knowledge across years for clinical facts, support and benefit rules', () => {
    const topics = (id: string) => swipeCards.find(c => c.id === id)!.topicIds;
    // A medication-management question can test a clinical pharmacology fact.
    expect(topics('2009-33:3')).toEqual(['drawer32.1.1.2.pharmacology#pharmacokinetics']);
    expect(topics('2009-33:4')).toEqual(['drawer32.1.1.1.drug_adverse_effects#symptoms']);
    expect(topics('2009-33:1')).toEqual(['drawer32.2.2.4.medication#nursing']);
    expect(topics('2012-36:4')).toEqual(['drawer32.2.2.4.suction#practice']);
    // The counseling setting does not override privacy or self-determination.
    expect(topics('2012-47:1')).toEqual(['drawer32.2.2.1.privacy#ethical']);
    expect(topics('2010-47:2')).toEqual(['drawer32.2.2.1.decision#ethical']);
    expect(topics('2012-59:3')).toEqual(['drawer32.4.4.2.guardianship#legal_powers']);
    expect(topics('2007-03:4')).toEqual(['drawer32.4.4.1.benefits.supplementary#applicable_services']);
    expect(topics('2005-16:4')).toEqual(['drawer32.4.4.1.certification#validity']);
    expect(topics('2010-43:2')).toEqual(['drawer32.3.3.1.preventive.short_stay_medical#principles']);
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
