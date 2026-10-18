import { useEffect, useRef, useState } from 'react';
import type { Question } from '../domain/models';
import { battleAnswer, battleOutcome, battleQuestions, ghostLog, readBattles, saveBattle, type BattleRecord } from '../domain/battle';
import { CopyQuestion } from './CopyQuestion';
import { RegisteredExplanation } from './RegisteredExplanation';
import { questionTarget } from '../domain/appExplanation';
import { OriginalImage } from './OriginalImage';
import { GlossaryText } from './GlossaryText';

const seconds = (ms:number)=>(ms/1000).toFixed(1)+'秒';
export function Battle({pool,seen,onBack}:{pool:readonly Question[];seen:ReadonlySet<string>;onBack:()=>void}) {
  const [match,setMatch] = useState<BattleRecord>();
  const [deck,setDeck] = useState<Question[]>([]);
  const [selected,setSelected] = useState<string[]>([]);
  const [elapsed,setElapsed] = useState(0);
  const [feedback,setFeedback] = useState<string>();
  const [review,setReview] = useState(false);
  const [saveError,setSaveError] = useState(false);
  const started = useRef(0), locked = useRef(false);
  const live = !!match && !match.completed;
  const index = match?.answers.length??0;
  const current = deck[index];
  const ghost = ghostLog(deck.length);
  const persist = (record:BattleRecord)=>{try{saveBattle(localStorage,record);}catch{setSaveError(true);}};
  useEffect(()=>{
    if(!live) return;
    const timer = window.setInterval(()=>setElapsed(Math.max(0,performance.now()-started.current)),100);
    return ()=>window.clearInterval(timer);
  },[live]);
  useEffect(()=>{
    if(!feedback) return;
    const timer=window.setTimeout(()=>{setFeedback(undefined);locked.current=false;},650);
    return ()=>window.clearTimeout(timer);
  },[feedback]);
  const start = ()=>{
    let history:BattleRecord[]=[];
    try{history=readBattles(localStorage);}catch{/* storage unavailable */}
    const encountered=new Set([...seen,...history.flatMap(r=>r.answers.map(a=>a.questionId)),...(match?.answers.map(a=>a.questionId)??[])]);
    const nextDeck=battleQuestions(pool,encountered);
    if(!nextDeck.length) return;
    const record:BattleRecord={id:crypto.randomUUID(),startedAt:new Date().toISOString(),questionIds:nextDeck.map(q=>q.id),answers:[],completed:false,chain:match?.completed?match.chain+1:1};
    setDeck(nextDeck);setMatch(record);setSelected([]);setElapsed(0);setReview(false);setFeedback(undefined);locked.current=false;
    started.current=performance.now();persist(record);window.scrollTo({top:0,behavior:'instant'});
  };
  const submit = ()=>{
    if(!match || !current || locked.current || match.completed) return;
    const time=Math.max(0,performance.now()-started.current);
    const answer=battleAnswer(current,selected,time,new Date().toISOString());
    if(!answer) return;
    locked.current=true;
    const next={...match,answers:[...match.answers,answer],completed:index+1===deck.length};
    setMatch(next);setElapsed(time);setSelected([]);persist(next);
    setFeedback(`${index+1}問目 ${answer.correct?'正解！':'不正解'}`);
    window.scrollTo({top:0,behavior:'instant'});
  };
  const correct=match?.answers.filter(a=>a.correct).length??0;
  const visibleGhost=ghost.filter(a=>a.elapsedMs<=elapsed);
  return <section className="battle-screen">
    <div className="quest-heading"><button className="text-button" onClick={onBack}>‹ ホーム</button><span>対戦PoC · テストゴースト</span></div>
    {saveError&&<p role="alert">対戦記録を保存できません。この画面では続けて遊べます。</p>}
    {!match&&<>
      <h1>知識で、一歩先へ。</h1><p>正確に解いて、速さで差をつける。</p>
      <div className="panel"><h2>10問勝負</h2><p>正答数が多い方の勝ち。同数なら、全問を解き終えるまでの時間で決着。</p><p>相手はテスト用ゴーストです。過去問演習で選んだ範囲から、最大10問を出題します。</p></div>
      <button className="primary" disabled={!pool.length} onClick={start}>対戦を始める</button>
      {!pool.length&&<p>出題範囲を過去問演習の設定で変更してください。</p>}
    </>}
    {live&&current&&<>
      <div className="battle-scoreboard" aria-label="対戦の進捗"><div><small>あなた</small><b>{correct} 正解</b><span>{index} / {deck.length}問</span></div><div className="battle-clock">{seconds(elapsed)}</div><div><small>ゴースト</small><b>{visibleGhost.filter(a=>a.correct).length} 正解</b><span>{visibleGhost.length} / {deck.length}問</span></div></div>
      <p className="battle-feedback" role="status">{feedback??`第${index+1}問 / ${deck.length}問`}</p>
      <h1 className="question-title">{current.title}</h1><p className="question-stem">{current.stem}</p>
      <p className="fine-print">試験当時の正答で採点 · {current.original?.textStatus==='proofread'?'原本との初回照合済み':'文字校正未完了・誤記の可能性あり'}</p>
      <div className="selection-instruction"><b>{current.selectionCount}つ選択</b><span>{selected.length} / {current.selectionCount}</span></div>
      <div className="options" role="group" aria-label="対戦の選択肢">{current.options.map(o=><button key={o.id} className={`option ${selected.includes(o.id)?'selected':''}`} aria-pressed={selected.includes(o.id)} disabled={!!feedback} onClick={()=>setSelected(ids=>ids.includes(o.id)?ids.filter(id=>id!==o.id):ids.length<current.selectionCount?[...ids,o.id]:ids)}><span className="option-number">{o.id}</span><span>{o.text}</span></button>)}</div>
      <div className="answer-dock"><button className="primary" disabled={!!feedback||selected.length!==current.selectionCount} onClick={submit}>解答して次へ</button></div>
      <p className="fine-print">画面を離れても時間は進みます。ホームへ戻ると対戦を終了します。</p>
    </>}
    {match?.completed&&<>
      <div className={`battle-result ${battleOutcome(match.answers,ghost)}`}><p>{match.chain}戦目</p><h1>{({win:'あなたの勝利！',lose:'あと一歩、次の勝負へ',draw:'引き分け！'})[battleOutcome(match.answers,ghost)]}</h1><p>{battleOutcome(match.answers,ghost)==='draw'?'正答数もタイムも同じ':battleOutcome(match.answers,ghost)==='lose'?'ゴーストの勝利':correct===ghost.filter(a=>a.correct).length?'同じ正答数、タイムで決着':'正答数で決着'}</p></div>
      <div className="battle-scoreboard"><div><small>あなた</small><b>{correct} / {deck.length} 正解</b><span>{seconds(match.answers.at(-1)!.elapsedMs)}</span></div><div><small>ゴースト</small><b>{ghost.filter(a=>a.correct).length} / {deck.length} 正解</b><span>{seconds(ghost.at(-1)!.elapsedMs)}</span></div></div>
      <button className="primary" onClick={start}>もう一戦</button>
      <button className="secondary" onClick={()=>setReview(v=>!v)}>{review?'復習を閉じる':`間違えた${deck.length-correct}問を確認`}</button>
      {review&&<div className="battle-review">{match.answers.filter(a=>!a.correct).length===0&&<p>全問正解です！</p>}{match.answers.map((a,i)=>a.correct?null:<article className="panel" key={a.questionId}><h2>{deck[i].title}</h2><p><GlossaryText text={deck[i].stem}/></p><p className="answer-key">正答：{(deck[i].answerVariants??[deck[i].answerIds]).map(ids=>ids.join('・')).join(' または ')} ／ あなた：{a.selectedIds.join('・')}</p>{deck[i].options.map(o=><p key={o.id}>{o.id}. <GlossaryText text={o.text}/></p>)}<RegisteredExplanation target={questionTarget(deck[i])}/><CopyQuestion question={deck[i]} includeAnswer selectedIds={a.selectedIds}/>{deck[i].original?.imagePath&&<OriginalImage question={deck[i]}/>}</article>)}</div>}
    </>}
    <details className="help-details"><summary>対戦のルールと記録</summary><p>相手は固定の正誤・解答時間を持つテストデータです。同じ出題列に割り当てて再生し、実在の人とのリアルタイム対戦やレーティングは行いません。相手の終了を待たずに結果を比較します。</p><p>正答数を優先し、同数なら所要時間で勝敗を決めます。短い正誤表示・バックグラウンド滞在も所要時間に含みます。全問の正答数と時間が同じ場合は引き分けです。</p><p>対戦・過去問演習・○×学習で解いた問題は後回しにし、同じ条件では校正済みを優先します。問題不足時は再出題します。</p><p>回答時刻・各問の正誤・経過時間・連戦数を、この端末に直近100戦まで保存します。途中終了の回答も残ります。既存の学習履歴・XPには加算しません。再読み込み時は対戦を再開できません。</p></details>
  </section>;
}
