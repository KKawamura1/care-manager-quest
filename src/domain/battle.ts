import type { Question } from './models';
import { isCorrect } from './game';

export const BATTLE_STORAGE_KEY = 'care-manager-quest:battle:v1';
export interface BattleAnswer {
  questionId: string; questionVersion: number; selectedIds: string[];
  correct: boolean; elapsedMs: number; answeredAt: string;
}
export interface BattleRecord {
  id: string; startedAt: string; questionIds: string[]; answers: BattleAnswer[];
  completed: boolean; chain: number;
}
export interface GhostAnswer { correct: boolean; elapsedMs: number }
// Deliberately labelled test data, not a claim about real players or question difficulty.
const TEST_LOG: GhostAnswer[] = [
  {correct:true,elapsedMs:24000},{correct:true,elapsedMs:55000},
  {correct:false,elapsedMs:81000},{correct:true,elapsedMs:123000},
  {correct:true,elapsedMs:151000},{correct:false,elapsedMs:187000},
  {correct:true,elapsedMs:216000},{correct:true,elapsedMs:255000},
  {correct:false,elapsedMs:283000},{correct:true,elapsedMs:320000},
];
export const ghostLog = (count: number): GhostAnswer[] => TEST_LOG.slice(0, count).map(a=>({...a}));
export function battleQuestions(pool: readonly Question[], seen: ReadonlySet<string>, random = Math.random): Question[] {
  // Unseen first, then proofread, random order within each tier. Never edit source text.
  return pool.filter(q=>q.options.length===5 && [2,3].includes(q.selectionCount))
    .map(q=>({q, tie:random()})).sort((a,b)=>Number(seen.has(a.q.id))-Number(seen.has(b.q.id)) ||
      Number(b.q.original?.textStatus==='proofread')-Number(a.q.original?.textStatus==='proofread') || a.tie-b.tie)
    .slice(0,10).map(({q})=>q);
}
export function battleAnswer(q: Question, ids: string[], elapsedMs: number, answeredAt: string): BattleAnswer | undefined {
  if (ids.length!==q.selectionCount || new Set(ids).size!==ids.length || ids.some(id=>!q.options.some(o=>o.id===id)) || !Number.isFinite(elapsedMs) || elapsedMs<0) return;
  return {questionId:q.id,questionVersion:q.version,selectedIds:[...ids],correct:isCorrect(q,ids),elapsedMs,answeredAt};
}
export function battleOutcome(player: readonly GhostAnswer[], ghost: readonly GhostAnswer[]): 'win'|'lose'|'draw' {
  const correct = (answers: readonly GhostAnswer[])=>answers.filter(a=>a.correct).length;
  const difference = correct(player)-correct(ghost);
  if(difference) return difference>0?'win':'lose';
  const time = (player.at(-1)?.elapsedMs??0)-(ghost.at(-1)?.elapsedMs??0);
  return time===0?'draw':time<0?'win':'lose';
}
export function readBattles(storage: Pick<Storage,'getItem'>): BattleRecord[] {
  try {
    const value: unknown = JSON.parse(storage.getItem(BATTLE_STORAGE_KEY)??'[]');
    if(!Array.isArray(value)) return [];
    return value.filter((r): r is BattleRecord => r && typeof r.id==='string' && typeof r.startedAt==='string' && typeof r.completed==='boolean' && Number.isInteger(r.chain) && r.chain>0 &&
      Array.isArray(r.questionIds) && r.questionIds.length>0 && r.questionIds.length<=10 && r.questionIds.every((id:unknown)=>typeof id==='string') &&
      Array.isArray(r.answers) && r.answers.length<=r.questionIds.length && (!r.completed || r.answers.length===r.questionIds.length) &&
      r.answers.every((a:BattleAnswer,i:number)=>a && a.questionId===r.questionIds[i] && Number.isInteger(a.questionVersion) && Array.isArray(a.selectedIds) && a.selectedIds.every(id=>typeof id==='string') && typeof a.correct==='boolean' && typeof a.answeredAt==='string' && Number.isFinite(a.elapsedMs) && a.elapsedMs>=0 && (i===0 || a.elapsedMs>=r.answers[i-1].elapsedMs))).slice(-100);
  } catch { return []; }
}
export function saveBattle(storage: Pick<Storage,'getItem'|'setItem'>, record: BattleRecord) {
  storage.setItem(BATTLE_STORAGE_KEY,JSON.stringify([...readBattles(storage).filter(r=>r.id!==record.id),record].slice(-100)));
}
