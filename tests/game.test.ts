import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { categories, concepts } from '../src/data/knowledge';
import { officialProvider, legacyQuestions } from '../src/data/provider';
import { sources } from '../src/data/sources';
import { advance, awardXp, buildSession, conceptStatus, emptyPlayer, isCorrect, levelInfo, reflect, submitAnswer, totalXp } from '../src/domain/game';
import { loadPlayer, MAX_IMPORT_BYTES, parsePlayer, savePlayer, validExternalUrl } from '../src/domain/storage';
import type { PlayerState } from '../src/domain/models';
const date='2026-10-10T10:00:00.000Z';
const questions=officialProvider.list();
function ready() {const p=emptyPlayer();p.session=buildSession(questions,[],'session-1',()=>0);return p;}
function answered(p:PlayerState,correct=true) { const q=questions.find(q=>q.id===p.session!.questionIds[p.session!.index])!;p={...p,session:{...p.session!,selectedIds:correct?q.answerIds:[...q.answerIds.slice(1),q.options.find(o=>!q.answerIds.includes(o.id))!.id]}};return submitAnswer(p,questions,date);}
describe('question pack contract',()=>{
 it('contains 60 official, text-backed questions with stable numbering and provisional map references',()=>{
  expect(questions).toHaveLength(60);expect(new Set(questions.map(q=>q.id)).size).toBe(60);expect(questions.filter(q=>q.domain==='介護支援分野')).toHaveLength(25);expect(questions.filter(q=>q.domain==='保健医療サービスの知識等')).toHaveLength(20);expect(questions.filter(q=>q.domain==='福祉サービスの知識等')).toHaveLength(15);
  for(const q of questions){expect(q.options).toHaveLength(5);expect([2,3]).toContain(q.selectionCount);expect(q.answerIds).toHaveLength(q.selectionCount);expect(new Set(q.answerIds).size).toBe(q.selectionCount);expect(q.answerIds.every(id=>q.options.some(o=>o.id===id))).toBe(true);expect(categories.some(c=>c.id===q.primaryCategory&&c.parentId&&c.available)).toBe(true);expect(q.conceptIds.length).toBeGreaterThan(1);expect(q.conceptIds.every(id=>concepts.some(c=>c.id===id))).toBe(true);expect(q.provenance.kind).toBe('official');expect(q.id).toMatch(/^2025-\d{2}$/);expect(q.original?.year).toBe(2025);expect(q.explanation).toBe('');expect(q.original?.imagePath).toBe(`/assets/questions/2025/q${q.id.split('-')[1]}.png`);if (Number(q.id.split('-')[1])<=25) expect(createHash('sha256').update(readFileSync(new URL(`../public${q.original!.imagePath}`,import.meta.url))).digest('hex')).toBe(q.original?.imageSha256);expect(q.provenance.verifiedAt).toBe('2026-10-10');expect(q.provenance.sources.length).toBeGreaterThan(0);for(const s of q.provenance.sources){expect(sources.some(source=>source.id===s.sourceId)).toBe(true);expect(s.locator).not.toBe('');}}
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
  const p=answered(ready());for(const mutate of [(x:PlayerState)=>x.attempts[0].xp=999,(x:PlayerState)=>x.attempts[0].questionVersion=99,(x:PlayerState)=>x.attempts.push(x.attempts[0]),(x:PlayerState)=>x.session!.index=4,(x:PlayerState)=>x.concepts[x.attempts[0].conceptIds[0]].correctQuestionIds.push('2025-25')]){const copy=structuredClone(p);mutate(copy);expect(()=>parsePlayer(JSON.stringify(copy))).toThrow();}
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

describe('official answers and stable history',()=>{
 it('scores every valid two/three-number combination for all 60 questions by exact set equality',()=>{
  for(const q of questions)for(let mask=0;mask<32;mask++){
   const ids=q.options.filter((_,i)=>mask&(1<<i)).map(o=>o.id);
   const expected=JSON.stringify([...ids].sort())===JSON.stringify([...q.answerIds].sort());
   expect(isCorrect(q,ids),`${q.id}: ${ids}`).toBe(expected);
  }
 });
 it('can exhaust the official pack in five quests without ever selecting legacy questions',()=>{
  let p=emptyPlayer();const ids:string[]=[];
  for(let n=0;n<12;n++){
   p.session=buildSession(questions,p.attempts,`all-${n}`,()=>0);
   ids.push(...p.session.questionIds);
   for(let i=0;i<5;i++)p=advance(answered(p));
  }
  expect(new Set(ids).size).toBe(60);expect(ids.every(id=>id.startsWith('2025-'))).toBe(true);
 });
 it('migrates schema 1, retains legacy XP/reflection/external records, and retires its active session',()=>{
  let p=emptyPlayer();p.session=buildSession(legacyQuestions,[],'legacy',()=>0);
  const q=legacyQuestions.find(q=>q.id===p.session!.questionIds[0])!;p.session.selectedIds=q.answerIds;
  p=reflect(submitAnswer(p,legacyQuestions,date),q.conceptIds);
  const old={...p,schemaVersion:1,attempts:p.attempts.map(({conceptIds,classificationRevision,difficulty,...a})=>a)};
  const migrated=parsePlayer(JSON.stringify(old));
  expect(migrated.schemaVersion).toBe(2);expect(totalXp(migrated)).toBe(totalXp(p));expect(migrated.concepts).toEqual(p.concepts);expect(migrated.session).toBeUndefined();
  expect(parsePlayer(JSON.stringify(migrated))).toEqual(migrated);
 });
 it('classification and difficulty revisions cannot invalidate recorded attempts or change XP',()=>{
  const p=answered(ready());const q=questions.find(q=>q.id===p.attempts[0].questionId)!;
  const original={conceptIds:q.conceptIds,classificationRevision:q.classificationRevision,difficulty:q.difficulty};
  try {q.conceptIds=['changed.classification'];q.classificationRevision=99;q.difficulty=3;expect(parsePlayer(JSON.stringify(p))).toEqual(p);}
  finally {Object.assign(q,original);}
 });
 it('stores pending text only as image-backed questions and never injects an independent explanation',()=>{
  expect(questions.filter(q=>q.original?.textStatus==='pending')).toHaveLength(60);expect(questions.every(q=>q.stem.trim()&&q.options.every(o=>o.text.trim()))).toBe(true);
  expect(questions.every(q=>!q.explanation&&!q.reasoning&&q.options.every(o=>!o.explanation))).toBe(true);
 });
});

