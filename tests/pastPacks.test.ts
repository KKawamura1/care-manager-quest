import { describe, expect, it } from 'vitest';
import { categories, concepts } from '../src/data/knowledge';
import { availableYears, questions } from '../src/data/provider';
import { excludedPastExamIds, pastExamTexts, pastProvider } from '../src/data/past-provider';
import { sources } from '../src/data/sources';
import { advance, buildSession, emptyPlayer, isCorrect, submitAnswer } from '../src/domain/game';
import { parsePlayer } from '../src/domain/storage';
import { questionCopyText } from '../src/domain/questionCopy';

const past=pastProvider.list();
describe('published historical exam packs',()=>{
  it('retains 60 items per year, excludes the cancelled question, and resolves every classification and source',()=>{
    expect(pastExamTexts).toHaveLength(780);
    expect(past).toHaveLength(779);
    expect(excludedPastExamIds).toEqual(['2005-28']);
    expect(availableYears).toEqual([2025,2017,2016,2015,2014,2013,2012,2011,2010,2009,2008,2007,2006,2005]);
    expect(new Set(questions.map(q=>q.id)).size).toBe(839);
    for(let year=2005;year<=2017;year++){
      expect(pastExamTexts.filter(q=>q.year===year).map(q=>q.number).sort((a,b)=>a-b)).toEqual(Array.from({length:60},(_,i)=>i+1));
    }
    for(const q of past){
      expect(q.options).toHaveLength(5);
      expect(q.stem.trim()).not.toBe('');
      expect(q.options.every(o=>o.text.trim())).toBe(true);
      expect(q.answerIds).toHaveLength(q.selectionCount);
      expect(q.answerIds.every(id=>q.options.some(o=>o.id===id))).toBe(true);
      expect(q.original?.imagePath).toBeUndefined();
      expect(q.original?.textStatus).toBe('pending');
      expect(q.original?.lawStatus).toBe('not_reviewed');
      expect(categories.some(c=>c.id===q.primaryCategory&&c.available)).toBe(true);
      expect(q.conceptIds.every(id=>concepts.some(c=>c.id===id))).toBe(true);
      for(const s of q.provenance.sources)expect(sources.find(source=>source.id===s.sourceId)?.url).toMatch(/^https:\/\//);
      expect(q.explanation).toBe('');
    }
  });
  it('scores all option subsets and all officially accepted variants, rejecting duplicate selections',()=>{
    expect(past.find(q=>q.id==='2006-19')?.answerVariants).toEqual([['1','3'],['1','5'],['3','5']]);
    expect(past.find(q=>q.id==='2009-21')?.answerVariants).toEqual([['1','3'],['1','4'],['3','4']]);
    expect(past.find(q=>q.id==='2014-39')?.answerIds).toEqual(['1','2','5']);
    for(const q of past){
      const variants=q.answerVariants??[q.answerIds];
      for(let mask=0;mask<32;mask++){
        const ids=q.options.filter((_,i)=>mask&(1<<i)).map(o=>o.id);
        const expected=variants.some(v=>v.length===ids.length&&v.every(id=>ids.includes(id)));
        expect(isCorrect(q,ids),`${q.id}: ${ids}`).toBe(expected);
      }
      expect(isCorrect(q,[...q.answerIds,q.answerIds[0]])).toBe(false);
    }
  });
  it('can resume historical answers and variants through portable history without mixing selected years',()=>{
    const pool=past.filter(q=>q.original?.year===2006);
    let p=emptyPlayer();p.session=buildSession(pool,[],'past',()=>0);
    expect(p.session.questionIds.every(id=>id.startsWith('2006-'))).toBe(true);
    p.session.questionIds=['2006-19',...pool.filter(q=>q.id!=='2006-19').slice(0,4).map(q=>q.id)];p.session.selectedIds=['3','5'];
    p=submitAnswer(p,questions,'2026-10-10T10:00:00.000Z');
    expect(p.attempts[0].correct).toBe(true);
    expect(parsePlayer(JSON.stringify(p))).toEqual(p);
    p=advance(p);p.session!.selectedIds=['1'];
    expect(parsePlayer(JSON.stringify(p))).toEqual(p);
    expect(questionCopyText(pool.find(q=>q.id==='2006-19')!,true)).toContain('1・3 または 1・5 または 3・5');
  });
});
