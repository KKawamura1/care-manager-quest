import { describe, expect, it } from 'vitest';
import { categories, concepts, choiceClassifications } from '../src/data/knowledge';
import { questions } from '../src/data/provider';
import { swipeCards, swipeCatalog } from '../src/data/swipe-provider';
import { emptyPlayer, submitAnswer, totalXp, conceptStatus } from '../src/domain/game';
import { knowledgeProgress } from '../src/domain/knowledgeProgress';
import { parsePlayer } from '../src/domain/storage';
import classificationManifest from '../docs/taxonomy/issue-32-experiment/manifest.json';

describe('production choice taxonomy and knowledge progress', () => {
  it('uses four roots and option-specific drawers in both learning modes', () => {
    expect(categories.filter(c => !c.parentId).map(c => c.label)).toEqual([
      '人の健康と生活', '支援の考え方と方法', '支援の提供体制', '社会保障の仕組み',
    ]);
    expect(concepts).toHaveLength(classificationManifest.normalization_summary.normalized_drawer_count);
    expect(categories.filter(c => c.parentId)).toHaveLength(classificationManifest.normalization_summary.concept_count);
    expect(swipeCatalog.unclassified).toHaveLength(0);
    expect(questions.every(q=>q.conceptIds.length>0)).toBe(true);
    for (const card of swipeCards) {
      const key = `${card.year}-${String(card.number).padStart(2,'0')}:${card.choiceId}`;
      expect(card.topicIds).toEqual((choiceClassifications as Record<string,{drawerIds:string[]}>)[key].drawerIds);
    }
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

  it('projects each five-choice option into its own drawer, keeping XP and map in sync', () => {
    const q = questions.find(q=>swipeCards.filter(card=>card.questionId===q.id).length===5)!;
    let p = emptyPlayer();
    p.session = {id:'one',questionIds:[q.id,...questions.filter(q2=>q2.id!==q.id).slice(0,4).map(q2=>q2.id)],index:0,selectedIds:q.answerIds,completed:false};
    p = submitAnswer(p,questions,'2026-10-11T00:00:00Z');
    expect(p.learningEvents).toHaveLength(5);
    expect(p.learningEvents.every(e=>e.mode==='five-choice')).toBe(true);
    expect(totalXp(p)).toBe(70);
    expect(parsePlayer(JSON.stringify(p))).toEqual(p);
    const mapped = knowledgeProgress(p,questions);
    const card = swipeCards.find(card=>card.questionId===q.id)!;
    const drawer = mapped[card.topicIds[0]];
    expect(drawer.seenQuestionIds).toContain(card.id);
    expect(drawer.level).toBeGreaterThan(0);
    expect(drawer.level).toBeLessThan(1);
    expect(conceptStatus(drawer)).toBe('learning');
    expect(drawer.review).toBeGreaterThanOrEqual(0);
  });
});
