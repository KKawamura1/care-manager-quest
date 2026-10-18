import { describe, expect, it } from 'vitest';
import { cardTarget, questionTarget } from '../src/domain/appExplanation';
import { parseRegisteredExplanation, matchingRegisteredExplanations } from '../src/domain/registeredExplanation';
import { registeredExplanations, registrationErrors } from '../src/data/registered-explanations';
import { questionById } from '../src/data/provider';
import { swipeCardById } from '../src/data/swipe-provider';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const id = '5f87b431-616d-42bd-ae39-c531ab2de056';
const path = `data/explanations/entries/${id}.json`;
const card = swipeCardById.get('2021-10:4')!;
const target = cardTarget(card);
const value = { schemaVersion:1, ...target, explanation:'名義貸しは、正当な理由があっても認められません。', registrationId:id, registeredAt:'2026-10-18T06:24:10Z' };

describe('one-file explanation registrations', () => {
  it('validates every registered file during automatic builds, without an index', () => {
    expect(registrationErrors).toEqual([]);
    for (const entry of registeredExplanations) {
      expect(questionById(entry.questionId),entry.registrationId).toBeDefined();
      if (entry.choiceId) expect(swipeCardById.get(`${entry.questionId}:${entry.choiceId}`),entry.registrationId).toBeDefined();
    }
  });
  it('checks that newly added records match the current question in the main-push workflow', () => {
    if (process.env.VALIDATE_REGISTERED_ADDITIONS !== '1') return;
    const added = execFileSync('git',['diff','--name-only','--diff-filter=A','HEAD^','HEAD','--','data/explanations/entries'],{encoding:'utf8'}).trim().split('\n').filter(path => path.endsWith('.json'));
    for (const path of added) {
      const entry = parseRegisteredExplanation(JSON.parse(readFileSync(path,'utf8')),path);
      const q = questionById(entry.questionId);
      expect(q,`${path}: 問題が見つかりません`).toBeDefined();
      const card = entry.choiceId ? swipeCardById.get(`${entry.questionId}:${entry.choiceId}`) : undefined;
      if (entry.choiceId) expect(card,`${path}: カードが見つかりません`).toBeDefined();
      const current = card ? cardTarget(card) : questionTarget(q!);
      expect(matchingRegisteredExplanations([entry],current),`${path}: 改訂印が一致しません。問題をコピーし直してください`).toHaveLength(1);
    }
  });
  it('accepts choice registration records and orders their history', () => {
    const entry = parseRegisteredExplanation(value,path);
    expect(matchingRegisteredExplanations([entry],target)[0].explanation).toBe(value.explanation);
    const olderId = '5f87b431-616d-42bd-ae39-c531ab2de055';
    const older = parseRegisteredExplanation({...value,registrationId:olderId,registeredAt:'2026-10-18T06:00:00Z'},`data/explanations/entries/${olderId}.json`);
    expect(matchingRegisteredExplanations([older,entry],target)).toEqual([entry,older]);
    expect(matchingRegisteredExplanations([entry,older],target)).toEqual([entry,older]);
    const tied = {...older,registeredAt:entry.registeredAt};
    expect(matchingRegisteredExplanations([tied,entry],target).map(e => e.registrationId)).toEqual([id,olderId]);
  });
  it('does not show a stale revision or another target, even when it is newer', () => {
    const entry = parseRegisteredExplanation(value,path);
    const stale = {...entry,cardRevision:'deadbeef',registeredAt:'2026-10-19T00:00:00Z'};
    expect(matchingRegisteredExplanations([stale,entry],target)).toEqual([entry]);
    for (const patch of [{questionId:'2021-11'},{choiceId:'3'},{cardRevision:'1234'},{questionVersion:2}]) {
      expect(matchingRegisteredExplanations([entry],{...target,...patch})).toEqual([]);
    }
    expect(matchingRegisteredExplanations([entry],questionTarget(questionById(card.questionId)!))).toEqual([]);
  });
  it('stamps question-level text, options and answers', () => {
    const q = questionById('2021-10')!;
    const qt = questionTarget(q);
    const entry = parseRegisteredExplanation({...value,...qt,choiceId:undefined,cardRevision:undefined},path);
    expect(matchingRegisteredExplanations([entry],qt)).toHaveLength(1);
    for (const changed of [{...q,stem:q.stem+'修正'},{...q,answerIds:['1','2']},{...q,options:q.options.map((o,i) => i ? o : {...o,text:'修正'})}]) {
      expect(matchingRegisteredExplanations([entry],questionTarget(changed))).toEqual([]);
    }
    expect(() => parseRegisteredExplanation({...entry,questionRevision:undefined},path)).toThrow();
  });
  it('rejects mismatched IDs, invalid metadata, unsafe sources and oversized explanations', () => {
    for (const patch of [{schemaVersion:2},{explanation:''},{explanation:null},{registrationId:'not-a-uuid'},{questionId:'../x'},{questionVersion:0},{choiceId:'6'},
      {registeredAt:'2026-02-30T00:00:00Z'},{registeredAt:'invalid'}, {explanation:'x'.repeat(601)},
      {sources:[{title:'bad',url:'javascript:alert(1)'}]},{sources:[{title:'bad',url:'https://user:pass@example.com'}]}]) {
      expect(() => parseRegisteredExplanation({...value,...patch},path)).toThrow();
    }
    expect(() => parseRegisteredExplanation(value,'data/explanations/entries/other.json')).toThrow();
    expect(parseRegisteredExplanation({...value,sources:[{title:'介護保険法',url:'https://www.mhlw.go.jp/'}]},path).sources).toHaveLength(1);
  });
});
