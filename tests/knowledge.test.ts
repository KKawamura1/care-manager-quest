import { describe, expect, it } from 'vitest';
import { categories, concepts, choiceClassifications } from '../src/data/knowledge';
import { questions } from '../src/data/provider';
import { swipeCards, swipeCatalog } from '../src/data/swipe-provider';
import { emptyPlayer, submitAnswer, totalXp, conceptStatus } from '../src/domain/game';
import { knowledgeProgress } from '../src/domain/knowledgeProgress';
import { parsePlayer } from '../src/domain/storage';
import { recordLearning } from '../src/domain/learning';
import migrationSummary from '../docs/taxonomy/issue-32-experiment/migration-5x28-summary.json';

describe('production choice taxonomy and knowledge progress', () => {
  it('fills a drawer after two correct daily answers on every card and preserves it through import', () => {
    const id = swipeCards[0].topicIds[0];
    const cards = swipeCards.filter(card => card.topicIds.includes(id));
    let player = emptyPlayer();
    const choices = cards.map(card => ({ card, answer: card.truth }));
    player.learningEvents = recordLearning([], choices, '2026-10-11T10:00:00+09:00', 'swipe');
    expect(knowledgeProgress(player, questions)[id].level).toBeCloseTo(2/3);
    player.learningEvents = recordLearning(player.learningEvents, choices, '2026-10-13T10:00:00+09:00', 'five-choice');
    player = parsePlayer(JSON.stringify(player));
    const progress = knowledgeProgress(player, questions)[id];
    expect(progress.level).toBe(1);
    expect(conceptStatus(progress)).toBe('mastered');
  });

  it('uses fixed five roots, 28 middles and option-specific drawers in both learning modes', () => {
    expect(categories.filter(c => !c.parentId).map(c => c.label)).toEqual([
      '介護保険制度', 'ケアマネジメント', '介護保険サービス', '高齢者保健医療', '高齢者福祉',
    ]);
    expect(concepts).toHaveLength(migrationSummary.drawer_count);
    expect(categories.filter(c => c.parentId && !c.id.startsWith('concept5.'))).toHaveLength(28);
    expect(categories.filter(c => c.id.startsWith('concept5.'))).toHaveLength(migrationSummary.active_concept_count);
    const byCategory = new Map(categories.map(c => [c.id,c]));
    for(const c of concepts) {
      const small=byCategory.get(c.categoryId)!;
      const middle=byCategory.get(small.parentId!)!;
      const root=byCategory.get(middle.parentId!)!;
      expect(small.id.startsWith('concept5.')).toBe(true);
      expect(middle.id).toMatch(/^[1-5]\.[1-8]$/);
      expect(root.parentId).toBeUndefined();
    }
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
    // New ambiguous placement never inherits approval just because the old
    // classification had a semantic review; stable mappings keep their approval.
    expect(reviewedCards.find(c=>c.number===42&&c.choiceId==='2')!.classificationStatus).toBe('reviewed');
    const drawer = (number: number, choice: number) => reviewedCards.find(c => c.number === number && c.choiceId === String(choice))!.topicIds[0];
    expect(drawer(29, 2)).toBe('drawer5.3.3.day_rehab#preventive_eligibility');
    expect(drawer(25, 4)).toBe('drawer5.3.7.group_home#eligibility');
    expect(drawer(30, 5)).toBe('drawer5.1.4.benefit_types#applicable_services');
    expect(drawer(36, 5)).toBe('drawer5.4.2.metabolic#scope_diabetes_treatment');
    expect(drawer(42, 2)).toBe('drawer5.4.4.adverse_effects#symptoms');
    expect(drawer(42, 3)).toBe('drawer5.4.6.professional_practice#scope_care_worker_authority');
    expect(drawer(42, 5)).toBe('drawer5.4.4.adverse_effects#risk');
    expect(drawer(41, 5)).toBe('drawer5.4.6.professional_practice#scope_nurse_authority');
    expect(drawer(40, 4)).toBe('drawer5.4.6.acp#documentation');
    expect(drawer(44, 4)).toBe('drawer5.3.7.nursing_multi#care_plan');
    expect(drawer(50, 3)).toBe('drawer5.3.2.visiting_care#care_plan');
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
    expect(topics('2009-33:3')).toEqual(['drawer5.4.4.pharmacology#pharmacokinetics']);
    expect(topics('2009-33:4')).toEqual(['drawer5.4.4.adverse_effects#symptoms']);
    expect(topics('2009-33:1')).toEqual(['drawer5.4.6.medication_support#nursing']);
    expect(topics('2012-36:4')).toEqual(['drawer5.4.6.respiratory_care#scope_suction_practice']);
    // The counseling setting does not override privacy or self-determination.
    expect(topics('2012-47:1')).toEqual(['drawer5.5.1.privacy#ethical']);
    expect(topics('2010-47:2')).toEqual(['drawer5.5.1.principles#ethical']);
    expect(topics('2012-59:3')).toEqual(['drawer5.5.3.legal_guardianship#legal_powers']);
    expect(topics('2007-03:4')).toEqual(['drawer5.1.4.supplementary#applicable_services']);
    expect(topics('2005-16:4')).toEqual(['drawer5.1.3.validity#validity']);
    expect(topics('2010-43:2')).toEqual(['drawer5.3.4.short_stay_medical#preventive_principles']);
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
