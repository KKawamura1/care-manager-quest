import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { questions } from '../src/data/provider';
import { concepts, categories } from '../src/data/knowledge';
import { sources } from '../src/data/sources';
import { EXAM_YEARS, filterQuestions, parseYearFilter } from '../src/domain/questionFilter';
import { advance, buildSession, emptyPlayer, isCorrect, submitAnswer } from '../src/domain/game';
import { parsePlayer } from '../src/domain/storage';
import { questionCopyText } from '../src/domain/questionCopy';
describe('2020–2024 import',()=>{
 it('retains all 300 uploaded IDs, every character, answer number and original image',()=>{
  expect(questions).toHaveLength(1259);
  expect(new Set(questions.map(q=>q.id)).size).toBe(1259);
  expect(new Set(concepts.map(c=>c.id)).size).toBe(concepts.length);
  for(const year of EXAM_YEARS.filter(y=>y>=2020&&y!==2025)) {
   const document=JSON.parse(readFileSync(new URL(`../imports/${year}/questions.json`,import.meta.url),'utf8'));
   const rows=document.questions??document;
   expect(filterQuestions(questions,year,'all')).toHaveLength(60);
   expect(filterQuestions(questions,year,'介護支援分野')).toHaveLength(25);
   expect(filterQuestions(questions,year,'保健医療サービスの知識等')).toHaveLength(20);
   expect(filterQuestions(questions,year,'福祉サービスの知識等')).toHaveLength(15);
   for(const raw of rows) {
    const q=questions.find(q=>q.id===raw.id)!;
    expect(q.stem).toBe(raw.stem);
    expect(q.options.map(o=>o.text)).toEqual(raw.choices);
    expect(q.answerIds).toEqual((raw.correct_choices??raw.correct_answers).map(String));
    expect(q.selectionCount).toBe(raw.required_choices);
    expect(q.original?.year).toBe(year);
    expect(q.original?.textStatus).toBe('pending');
    const file=new URL(`../public${q.original!.imagePath}`,import.meta.url);
    if (existsSync(file))expect(createHash('sha256').update(readFileSync(file)).digest('hex')).toBe(q.original?.imageSha256);
    else expect(q.original?.imageSha256).toBe(raw.image_sha256);
    expect(q.provenance.sources.every(s=>sources.some(source=>source.id===s.sourceId))).toBe(true);
    expect(categories.some(c=>c.id===q.primaryCategory)).toBe(true);
    expect(q.conceptIds.every(id=>concepts.some(c=>c.id===id))).toBe(true);
    for(let mask=0;mask<32;mask++){
     const ids=q.options.filter((_,i)=>mask&(1<<i)).map(o=>o.id);
     expect(isCorrect(q,ids)).toBe(JSON.stringify(ids)===JSON.stringify([...q.answerIds].sort()));
    }
    expect(questionCopyText(q,true)).toContain(`${year}年度`);
    expect(q.original?.sourceUrl).toMatch(/^https?:\/\//);
    expect(questionCopyText(q,true)).not.toContain(q.original!.sourceUrl);
   }
  }
 });
 it('offers 525 support questions or 1259 across all years, and defaults invalid preferences to 2025',()=>{
  expect(filterQuestions(questions,'all','介護支援分野')).toHaveLength(525);
  expect(filterQuestions(questions,'all','all')).toHaveLength(1259);
  for(const value of [null,'','2004','2026','broken'])expect(parseYearFilter(value)).toBe(2025);
  expect(parseYearFilter('2024')).toBe(2024);expect(parseYearFilter('all')).toBe('all');
 });
 it('keeps old 2025 answers, XP and in-progress session valid while newer sessions use another year',()=>{
  let player=emptyPlayer();
  for(const year of [2025,2020,2024] as const) {
   player.session=buildSession(filterQuestions(questions,year,'介護支援分野'),player.attempts,`year-${year}`,()=>0);
   for(let i=0;i<5;i++){
    const q=questions.find(q=>q.id===player.session!.questionIds[i])!;
    player.session!.selectedIds=q.answerIds;
    player=submitAnswer(player,questions,'2026-10-10T12:00:00Z');
    expect(parsePlayer(JSON.stringify(player))).toEqual(player);
    player=advance(player);
   }
  }
  expect(player.attempts).toHaveLength(15);
  expect(player.attempts.slice(0,5).every(a=>a.questionId.startsWith('2025-'))).toBe(true);
  expect(parsePlayer(JSON.stringify(player))).toEqual(player);
 });
 it('uses provisional 5x28 classifications for 2023 and 2024',()=>{
  expect(questions.filter(q=>q.original?.year===2023||q.original?.year===2024).every(q=>q.classificationStatus==='provisional'&&q.conceptIds.every(id=>id.startsWith('drawer5.')))).toBe(true);
 });
});
