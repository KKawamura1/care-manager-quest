import { describe, expect, it } from 'vitest';
import { buildStudyScope, parseStudyScope } from '../src/domain/studyScope';
import { studyScope } from '../src/data/study-scope';
import { categories } from '../src/data/knowledge';
import { questions } from '../src/data/provider';
import { swipeCards } from '../src/data/swipe-provider';
import { advance, buildSession, emptyPlayer, submitAnswer } from '../src/domain/game';
import { parsePlayer } from '../src/domain/storage';

describe('hierarchical study scope', () => {
  const index = buildStudyScope([
    {id:'root',label:'Root',description:'',available:true},
    {id:'middle',parentId:'root',label:'Middle',description:'',available:true},
    {id:'small',parentId:'middle',label:'Small',description:'',available:true},
  ], ['a','b'].map(id => ({id,categoryId:'small',label:id,summary:'',relatedIds:[]})));
  it('matches all four levels and counts multi-drawer items only once per ancestor', () => {
    expect(index.path('a')).toEqual(['root','middle','small','a']);
    for (const scope of ['all','root','middle','small','a','b']) expect(index.matches(['a','b'],scope)).toBe(true);
    expect(index.matches(['a'],'b')).toBe(false);
    expect(index.matches(['a'],'unknown')).toBe(false);
    const counts = index.counts([{topicIds:['a','b','a']},{topicIds:['a']},{topicIds:['unknown']}]);
    expect(Object.fromEntries(counts)).toEqual({all:3,root:2,middle:2,small:2,a:2,b:1});
    expect(parseStudyScope('missing',index)).toBe('all');
    expect(parseStudyScope('{broken',index)).toBe('all');
    expect(parseStudyScope('small',index)).toBe('small');
  });
  it('uses the current 5x28 tree for both modes, including 2020 legacy IDs', () => {
    const roots = categories.filter(c => !c.parentId);
    expect(roots).toHaveLength(5);
    const middles = categories.filter(c => roots.some(root => root.id === c.parentId));
    expect(middles).toHaveLength(28);
    for (const node of [...roots,...middles]) {
      const expectedQuestions = questions.filter(q => q.conceptIds.some(id => studyScope.path(id).includes(node.id)));
      expect(studyScope.counts(questions.map(q => ({topicIds:q.conceptIds}))).get(node.id) ?? 0).toBe(expectedQuestions.length);
      const expectedCards = swipeCards.filter(c => c.topicIds.some(id => studyScope.path(id).includes(node.id)));
      expect(studyScope.counts(swipeCards).get(node.id) ?? 0).toBe(expectedCards.length);
    }
    const disease = middles.find(c => c.label === '身体疾患・感染症')!;
    const pool = questions.filter(q => q.original?.year === 2020 && studyScope.matches(q.conceptIds,disease.id));
    expect(pool.length).toBeGreaterThan(0);
    expect(pool.every(q => q.id.startsWith('care_manager_2020_'))).toBe(true);
    for (const q of pool) expect(q.conceptIds.some(id => studyScope.path(id).includes(disease.id))).toBe(true);
  });
});

describe('quests with fewer than five matching questions', () => {
  it.each([1,2,3,4])('completes, saves and reloads a %i-question quest without repeats', size => {
    let player = emptyPlayer();
    const pool = questions.filter(q => q.original?.year === 2025).slice(0,size);
    player.session = buildSession(pool,[],`short-${size}`,() => 0);
    expect(new Set(player.session.questionIds).size).toBe(size);
    expect(advance(player)).toBe(player);
    for (let i=0;i<size;i++) {
      expect(player.session!.completed).toBe(false);
      const q = pool.find(q => q.id === player.session!.questionIds[i])!;
      player.session!.selectedIds = q.answerIds;
      player = submitAnswer(player,questions,'2026-10-12T10:00:00Z');
      expect(parsePlayer(JSON.stringify(player))).toEqual(player);
      player = advance(player);
    }
    expect(player.session!.completed).toBe(true);
    expect(player.attempts).toHaveLength(size);
    expect(parsePlayer(JSON.stringify(player))).toEqual(player);
    const badIndex = structuredClone(player); badIndex.session!.index = size;
    expect(() => parsePlayer(JSON.stringify(badIndex))).toThrow();
  });
  it('rejects an empty quest instead of constructing a broken session', () => {
    expect(() => buildSession([],[],'empty')).toThrow();
    const player = emptyPlayer();
    player.session = {id:'empty',questionIds:[],index:0,selectedIds:[],completed:false};
    expect(() => parsePlayer(JSON.stringify(player))).toThrow();
  });
});
