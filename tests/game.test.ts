import { describe, expect, it } from 'vitest';
import { categories, concepts } from '../src/data/knowledge';
import { questions } from '../src/data/provider';
import { sources } from '../src/data/sources';
import { advance, awardXp, buildSession, conceptStatus, emptyPlayer, isCorrect, levelInfo, reflect, submitAnswer, totalXp } from '../src/domain/game';
import { loadPlayer, MAX_IMPORT_BYTES, parsePlayer, savePlayer, validExternalUrl } from '../src/domain/storage';
import type { PlayerState } from '../src/domain/models';
const date='2026-10-10T10:00:00.000Z';
function ready() {const p=emptyPlayer();p.session=buildSession(questions,[],'session-1',()=>0);return p;}
function answered(p:PlayerState,correct=true) { const q=questions.find(q=>q.id===p.session!.questionIds[p.session!.index])!;p={...p,session:{...p.session!,selectedIds:correct?q.answerIds:q.options.filter(o=>!q.answerIds.includes(o.id)).slice(0,q.selectionCount).map(o=>o.id)}};return submitAnswer(p,questions,date);}
describe('question pack contract',()=>{
 it('contains 25 original, cited five-option questions with valid map references',()=>{
  expect(questions).toHaveLength(25);expect(new Set(questions.map(q=>q.id)).size).toBe(25);
  for(const q of questions){expect(q.options).toHaveLength(5);expect([2,3]).toContain(q.selectionCount);expect(q.answerIds).toHaveLength(q.selectionCount);expect(new Set(q.answerIds).size).toBe(q.selectionCount);expect(q.answerIds.every(id=>q.options.some(o=>o.id===id))).toBe(true);expect(categories.some(c=>c.id===q.primaryCategory&&c.parentId&&c.available)).toBe(true);expect(q.conceptIds.length).toBeGreaterThan(1);expect(q.conceptIds.every(id=>concepts.some(c=>c.id===id))).toBe(true);expect(q.provenance.kind).toBe('original');expect(q.provenance.verifiedAt).toBe('2026-10-10');expect(q.provenance.sources.length).toBeGreaterThan(0);for(const s of q.provenance.sources){expect(sources.some(source=>source.id===s.sourceId)).toBe(true);expect(s.locator).not.toBe('');}}
  for(const c of concepts)expect(c.relatedIds.every(id=>concepts.some(c=>c.id===id))).toBe(true);
 });
});
describe('quest rules',()=>{
 it('creates five unique questions in a paced rhythm and prefers unseen items',()=>{
  let p=ready();expect(p.session!.questionIds.map(id=>questions.find(q=>q.id===id)!.difficulty)).toEqual([1,2,3,1,2]);expect(new Set(p.session!.questionIds).size).toBe(5);
  for(let i=0;i<5;i++)p=advance(answered(p));const next=buildSession(questions,p.attempts,'session-2',()=>0);expect(next.questionIds.every(id=>!p.session!.questionIds.includes(id))).toBe(true);
 });
 it('matches a complete set, without order sensitivity or duplicates',()=>{
  const q=questions[0];expect(isCorrect(q,[...q.answerIds].reverse())).toBe(true);expect(isCorrect(q,[q.answerIds[0]])).toBe(false);expect(isCorrect(q,[q.answerIds[0],q.answerIds[0]])).toBe(false);expect(isCorrect(q,['1','2','3'])).toBe(false);
 });
 it('rejects premature progression, incomplete choices and double submission',()=>{
  const p=ready();expect(advance(p)).toBe(p);expect(submitAnswer(p,questions,date)).toBe(p);const a=answered(p);expect(submitAnswer(a,questions,date)).toBe(a);expect(a.attempts).toHaveLength(1);expect(totalXp(a)).toBe(60);
 });
 it('rewards first correct encounter, resets combos on misses and completes only after five answers',()=>{
  let p=answered(ready());expect(p.attempts[0].firstSeen).toBe(true);p=answered(advance(p));expect(p.attempts.at(-1)!.combo).toBe(2);p=answered(advance(p),false);expect(p.attempts.at(-1)!.combo).toBe(0);expect(p.attempts.at(-1)!.xp).toBe(10);p=answered(advance(p));expect(p.attempts.at(-1)!.combo).toBe(1);p=advance(answered(advance(p)));expect(p.session!.completed).toBe(true);expect(p.attempts).toHaveLength(5);expect(submitAnswer(p,questions,date)).toBe(p);
  p={...p,session:buildSession(questions,[],'repeat',()=>0)};p=answered(p);expect(p.attempts.at(-1)!.firstSeen).toBe(false);expect(p.attempts.at(-1)!.xp).toBe(40);expect(levelInfo(200).level).toBe(2);expect(awardXp(questions[0],true,true,5)).toBe(100);
 });
 it('keeps conceptual evidence distinct and does not master a single repeated question',()=>{
  let p=answered(ready());const q=questions.find(q=>q.id===p.session!.questionIds[0])!;const id=q.conceptIds[0];p=reflect(p,[id]);expect(conceptStatus(p.concepts[id])).toBe('learning');expect(conceptStatus({...p.concepts[id],correctQuestionIds:['a','b']})).toBe('mastered');expect(totalXp(reflect(p,[id]))).toBe(totalXp(p));expect(conceptStatus()).toBe('unexplored');
 });
});
describe('portable history',()=>{
 it('roundtrips answer feedback, a partial selection, reflection, external record and a completed result',()=>{
  let p=answered(ready());p=reflect(p,questions.find(q=>q.id===p.session!.questionIds[0])!.conceptIds);p.externalRecords=[{id:'external-1',url:'https://keamane.kakomonn.com/questions/12345',label:'第28回',correct:true,at:date}];expect(parsePlayer(JSON.stringify(p))).toEqual(p);
  p=advance(p);p.session!.selectedIds=['1'];expect(parsePlayer(JSON.stringify(p))).toEqual(p);p.session!.selectedIds=[];for(let i=1;i<5;i++)p=advance(answered(p));expect(parsePlayer(JSON.stringify(p))).toEqual(p);
 });
 it.each(['{','{}','{"schemaVersion":2}'])('rejects malformed/unknown schema without replacing history (%s)',s=>expect(()=>parsePlayer(s)).toThrow());
 it('rejects manipulated XP, evidence, stale question versions, duplicate attempts and broken sessions',()=>{
  const p=answered(ready());for(const mutate of [(x:PlayerState)=>x.attempts[0].xp=999,(x:PlayerState)=>x.attempts[0].questionVersion=99,(x:PlayerState)=>x.attempts.push(x.attempts[0]),(x:PlayerState)=>x.session!.index=4,(x:PlayerState)=>x.concepts.insurer.correctQuestionIds.push('cmq-025')]){const copy=structuredClone(p);mutate(copy);expect(()=>parsePlayer(JSON.stringify(copy))).toThrow();}
  expect(()=>parsePlayer(' '.repeat(MAX_IMPORT_BYTES+1))).toThrow(/2MB/);
 });
 it('rejects unsafe or noncanonical external links',()=>{
  expect(validExternalUrl('https://keamane.kakomonn.com/questions/123')).toBe(true);
  for(const url of ['javascript:alert(1)','https://keamane.kakomonn.com.evil.com/questions/123','https://user:pass@keamane.kakomonn.com/questions/123','http://keamane.kakomonn.com/questions/123','https://keamane.kakomonn.com/list1/123','https://keamane.kakomonn.com/questions/123?x=1'])expect(validExternalUrl(url)).toBe(false);
 });
 it('keeps corrupt raw data for recovery and reports unavailable storage',()=>{
  expect(loadPlayer({getItem:()=>'{broken'})).toMatchObject({raw:'{broken',error:expect.any(String)});expect(savePlayer({setItem:()=>{throw new Error('quota');}},emptyPlayer())).toMatch(/保存/);
 });
});
