import { describe, expect, it } from 'vitest';
import { battleAnswer, battleOutcome, battleQuestions, ghostLog, readBattles, saveBattle, type BattleRecord } from '../src/domain/battle';
import { questions } from '../src/data/provider';

describe('battle PoC',()=>{
  it('requires valid unique selections and uses the existing complete-match grading',()=>{
    for(const count of [2,3]) {
      const q=questions.find(q=>q.selectionCount===count)!;
      expect(battleAnswer(q,q.answerIds,1200,'now')?.correct).toBe(true);
      expect(battleAnswer(q,[...q.answerIds.slice(1)],1200,'now')).toBeUndefined();
      expect(battleAnswer(q,Array(count).fill(q.answerIds[0]),1200,'now')).toBeUndefined();
      expect(battleAnswer(q,Array(count).fill('invalid'),1200,'now')).toBeUndefined();
      expect(battleAnswer(q,q.answerIds,NaN,'now')).toBeUndefined();
    }
    const q={...questions[0],selectionCount:2,answerVariants:[['1','3'],['3','5']]};
    expect(battleAnswer(q,['5','3'],0,'now')?.correct).toBe(true);
  });
  it('prioritizes accuracy even against instant guesses, then speed, with ties',()=>{
    const answer=(correct:boolean,elapsedMs:number)=>({correct,elapsedMs});
    expect(battleOutcome([answer(true,999999)],[answer(false,0)])).toBe('win');
    expect(battleOutcome([answer(true,10)],[answer(true,20)])).toBe('win');
    expect(battleOutcome([answer(true,20)],[answer(true,10)])).toBe('lose');
    expect(battleOutcome([answer(true,20)],[answer(true,20)])).toBe('draw');
    // Exhaustively enumerate all 10^10 random answer outcomes via binomial multiplicity:
    // even zero-second guesses must get >=7/10 correct to beat the fixed ghost.
    let favorable=0;
    for(let correct=0;correct<=10;correct++) {
      const answers=Array.from({length:10},(_,i)=>answer(i<correct,0));
      let choose=1;for(let i=1;i<=correct;i++)choose=choose*(11-i)/i;
      if(battleOutcome(answers,ghostLog(10))==='win') favorable+=choose*9**(10-correct);
    }
    expect(favorable/10**10).toBeLessThan(0.00001);
  });
  it('samples without duplicates, unseen first and proofread within a tier',()=>{
    const pool=Array.from({length:12},(_,i)=>({...questions[0],id:String(i),original:{...questions[0].original!,textStatus:i===11?'proofread' as const:'pending' as const}}));
    const selected=battleQuestions(pool,new Set(['0','11']),()=>0.5);
    expect(selected.map(q=>q.id)).not.toContain('0');
    expect(selected.map(q=>q.id)).not.toContain('11');
    expect(new Set(selected.map(q=>q.id)).size).toBe(10);
    expect(battleQuestions(pool,new Set(),()=>0.5)[0].id).toBe('11');
    expect(battleQuestions([],new Set())).toEqual([]);
  });
  it('isolates and bounds records, preserving partial runs and rejecting corrupt input',()=>{
    const map=new Map<string,string>(); const storage={getItem:(k:string)=>map.get(k)??null,setItem:(k:string,v:string)=>{map.set(k,v);}};
    const record:BattleRecord={id:'a',startedAt:'now',questionIds:['q'],answers:[],completed:false,chain:1};
    saveBattle(storage,record);saveBattle(storage,{...record,chain:2});
    expect(readBattles(storage)).toEqual([{...record,chain:2}]);
    for(let i=0;i<105;i++)saveBattle(storage,{...record,id:String(i)});
    expect(readBattles(storage)).toHaveLength(100);
    expect(readBattles({getItem:()=>'{'})).toEqual([]);
    expect(readBattles({getItem:()=>JSON.stringify([{...record,answers:[null]}])})).toEqual([]);
  });
});
