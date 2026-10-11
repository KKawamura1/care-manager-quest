import { describe, expect, it } from 'vitest';
import { categories, concepts, choiceClassifications } from '../src/data/knowledge';
import { questions } from '../src/data/provider';
import { swipeCards, swipeCatalog } from '../src/data/swipe-provider';
import { emptyPlayer, submitAnswer, totalXp, conceptStatus } from '../src/domain/game';
import { knowledgeProgress } from '../src/domain/knowledgeProgress';
import { parsePlayer } from '../src/domain/storage';

describe('production choice taxonomy and knowledge progress', () => {
  it('uses four roots and option-specific drawers in both learning modes', () => {
    expect(categories.filter(c=>!c.parentId).map(c=>c.label)).toEqual(['人の健康と生活','支援の考え方と方法','支援の提供体制','社会保障の仕組み']);
    expect(concepts).toHaveLength(1159);
    expect(categories.filter(c=>c.parentId)).toHaveLength(487);
    expect(swipeCatalog.unclassified).toHaveLength(0);
    expect(questions.every(q=>q.conceptIds.length>0)).toBe(true);
    for (const card of swipeCards) {
      const key = `${card.year}-${String(card.number).padStart(2,'0')}:${card.choiceId}`;
      expect(card.topicIds).toEqual((choiceClassifications as Record<string,{drawerIds:string[]}>)[key].drawerIds);
    }
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
