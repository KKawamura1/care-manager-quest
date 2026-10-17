import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { availableYears, questionById } from '../data/provider';
import { swipeCards, swipeCardById, swipeConcepts, swipeCatalog } from '../data/swipe-provider';
import { filterSwipeCards, nextSwipeAvailableAt, progressFor, reviewQueue, type SwipeCard } from '../domain/swipe';
import { learningXp, recordLearning, swipeProgressFromEvents } from '../domain/learning';
import type { LearningEvent } from '../domain/models';
import { OriginalImage } from './OriginalImage';
import { CopyText } from './CopyQuestion';
import { AppExplanation } from './AppExplanation';
import { cardTarget } from '../domain/appExplanation';
import { swipeCopyText } from '../domain/questionCopy';
import { studyScope } from '../data/study-scope';
import { parseStudyScope } from '../domain/studyScope';
import { StudyScopePicker } from './StudyScopePicker';
import { GlossaryText } from './GlossaryText';
const SCOPE_STORAGE_KEY = 'care-manager-quest:swipe-scope';

export function SwipeStudy({ active, home, onStart, onBack, learningEvents, onAnswer, blocked }: {
  active: boolean; home: boolean; onStart: () => void; onBack: () => void;
  learningEvents: readonly LearningEvent[];
  onAnswer: (card: SwipeCard, answer: boolean | null, at: string, hintUsed?: boolean) => void;
  blocked: boolean;
}) {
  const state = useMemo(() => swipeProgressFromEvents(learningEvents, swipeCardById), [learningEvents]);
  const [year, setYear] = useState<number | 'all'>('all');
  const [homeHost, setHomeHost] = useState<HTMLElement | null>(null);
  const [topic, setTopic] = useState(() => {try{return parseStudyScope(window.localStorage.getItem(SCOPE_STORAGE_KEY),studyScope);}catch{return 'all';}});
  const [now, setNow] = useState(Date.now());
  const [card, setCard] = useState<SwipeCard>();
  const [result, setResult] = useState<{ answer: boolean | null; correct: boolean; xp: number }>();
  const [drag, setDrag] = useState({ x: 0, y: 0 });
  // A fresh deal also plays when practicing the same card again.
  const [deal, setDeal] = useState(0);
  const [original, setOriginal] = useState(false);
  const [hintUsed, setHintUsed] = useState(false);
  // Shared between the stem and option; confirmation applies to this attempt.
  const hintUsedRef = useRef(false);
  const confirmedHints = useRef(new Set<string>());
  const hintKey = card ? `${card.id}@${card.revision}` : '';
  const previouslyConfirmed = confirmedHints.current.has(hintKey) || learningEvents.some(event =>
    event.cardId === card?.id && event.revision === card?.revision && event.hintUsed);
  const requireHintConfirmation = !result && !hintUsed && !previouslyConfirmed;
  const resetHint = () => { hintUsedRef.current = false; setHintUsed(false); };
  const useHint = () => { if (card && !result && !locked.current) { confirmedHints.current.add(hintKey); hintUsedRef.current = true; setHintUsed(true); } };
  const gesture = useRef<{ x: number; y: number; id: number; phase: 'answer' | 'feedback' } | undefined>(undefined);
  const locked = useRef(false);
  const nextRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const yearCards = useMemo(() => filterSwipeCards(swipeCards, year, 'all'), [year]);
  const candidates = useMemo(() => yearCards.filter(c => studyScope.matches(c.topicIds, topic)), [yearCards, topic]);
  const available = useMemo(() => reviewQueue(candidates, state, now), [candidates, state, now]);
  const counts = useMemo(() => studyScope.counts(yearCards), [yearCards]);
  const changeTopic = (next: string) => {
    setTopic(next); setCard(undefined); setResult(undefined); locked.current = false;
    try {window.localStorage.setItem(SCOPE_STORAGE_KEY,next);}catch{/* continue without persistence */}
  };
  const reviewed = candidates.filter(c => progressFor(state, c)).length;
  const due = available.filter(c => progressFor(state, c)).length;
  const nextDue = available.length ? undefined : nextSwipeAvailableAt(candidates, state, now);
  useEffect(() => { setHomeHost(home ? document.getElementById('swipe-home-setup') : null); }, [home]);
  useEffect(() => { if (!active && !home) return; setNow(Date.now()); const timer = setInterval(() => setNow(Date.now()), 15_000); return () => clearInterval(timer); }, [active, home]);
  const submit = (answer: boolean | null) => {
    if (!card || blocked || result || locked.current) return;
    locked.current = true;
    const correct = answer !== null && answer === card.truth;
    const at = new Date().toISOString();
    const updated = recordLearning(learningEvents, [{card, answer, hintUsed: hintUsedRef.current}], at, 'swipe');
    const xp = learningXp(updated) - learningXp(learningEvents);
    onAnswer(card, answer, at, hintUsedRef.current);
    setResult({ answer, correct, xp }); setDrag({ x: 0, y: 0 });
    requestAnimationFrame(() => { nextRef.current?.focus({ preventScroll: true }); document.getElementById('swipe-feedback')?.scrollIntoView({ block: 'start', behavior: 'instant' }); });
  };
  const next = () => {
    if (!result || !locked.current) return;
    resetHint();
    setDeal(n => n + 1);
    locked.current = false; setResult(undefined); setOriginal(false); setDrag({ x: 0, y: 0 }); setNow(Date.now());
    // Pick from the latest review state: no artificial 20-card limit or session result.
    setCard(reviewQueue(candidates, state, Date.now())[0]);
    requestAnimationFrame(() => cardRef.current?.focus({ preventScroll: true }));
    window.scrollTo({ top: 0, behavior: 'instant' });
  };
  const practice = () => {
    if (blocked) return;
    const alreadyStudied = candidates.filter(candidate => progressFor(state, candidate));
    if (!alreadyStudied.length) return;
    resetHint();
    const nextCard = alreadyStudied[Math.floor(Math.random() * alreadyStudied.length)];
    setDeal(n => n + 1);
    locked.current = false;
    setCard(nextCard); setResult(undefined); setOriginal(false);
    onStart();
  };
  const retry = () => {
    if (!result) return;
    resetHint();
    setDeal(n => n + 1);
    locked.current = false;
    setResult(undefined); setOriginal(false); setDrag({x:0,y:0});
    requestAnimationFrame(() => cardRef.current?.focus({preventScroll:true}));
    window.scrollTo({top:0,behavior:'instant'});
  };
  const start = () => {
    if (blocked) return;
    const nextCard = reviewQueue(candidates, state, Date.now())[0];
    if (!nextCard) return;
    resetHint();
    setDeal(n => n + 1);
    locked.current = false; setCard(nextCard); setResult(undefined); setOriginal(false);
    onStart();
  };
  const down = (e: PointerEvent<HTMLDivElement>) => {
    if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0) || (e.target as HTMLElement).closest('button,a,input,summary')) return;
    gesture.current = { x: e.clientX, y: e.clientY, id: e.pointerId, phase: result ? 'feedback' : 'answer' }; e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current; if (!g || g.id !== e.pointerId) return;
    const dx = e.clientX - g.x, dy = e.clientY - g.y;
    if (result) return;
    setDrag(Math.abs(dx) > Math.abs(dy) * 1.4 ? { x: Math.max(-110, Math.min(110, dx)), y: 0 } : dy < 0 && Math.abs(dy) > Math.abs(dx) * 1.4 ? { x: 0, y: Math.max(-110, dy) } : { x: 0, y: 0 });
  };
  const up = (e: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current; gesture.current = undefined; setDrag({ x: 0, y: 0 });
    if (!g || g.id !== e.pointerId) return;
    const dx = e.clientX - g.x, dy = e.clientY - g.y;
    const horizontal = Math.abs(dx) >= 60 && Math.abs(dx) > Math.abs(dy) * 1.4;
    const upward = dy <= -60 && Math.abs(dy) > Math.abs(dx) * 1.4;
    if (!horizontal && !upward) return;
    if (g.phase === 'feedback') { if (result && horizontal) next(); }
    else if (!result) submit(upward ? null : dx > 0);
  };
  const setup = <div className="swipe-home-controls">
    <h2>○×学習</h2>
      <div className="swipe-settings">
        <label>年度<select aria-label="○×の年度" value={year} onChange={e => { setYear(e.target.value === 'all' ? 'all' : Number(e.target.value)); setCard(undefined); setResult(undefined); locked.current = false; }}>
          <option value="all">全年度</option>{availableYears.map(y => <option key={y} value={y}>{y}年度</option>)}
        </select></label>
        <StudyScopePicker value={topic} onChange={changeTopic} counts={counts} mode="○×" unit="枚"/>
        <p className="swipe-home-stats">{candidates.length}枚対象 · {reviewed}枚学習済み · {due}枚復習待ち</p>
        <button className="primary" aria-label={card ? '○×学習を再開する' : '○×学習を始める'} disabled={blocked || (!card && !available.length)} onClick={() => { if (card) onStart(); else start(); }}>{card ? '学習を再開する' : 'はじめる'}<span aria-hidden="true">→</span></button>
        {!available.length && !card && reviewed > 0 && <button className="secondary" disabled={blocked} onClick={practice}>解いたカードを再練習（XPなし）</button>}
         {!available.length && !card && <p role="status">今の条件で出せるカードはありません。{nextDue !== undefined && <>次の出題：{new Date(nextDue).toLocaleString('ja-JP')}</>} 年度・分野を変えると学習を続けられます。</p>}
      </div>
      <details className="swipe-home-detail"><summary>使い方</summary><p>右で○、左で×、上で「わからない」。解答後は上下にスクロールして解説を読めます。次へ進むには左右スワイプか「次のカードへ」ボタンを使ってください。</p>
        <p>正誤評価とXPはカードごとに日本時間で1日最初の回答だけを採用します。学習レベルは1回正解で約67%、別の日に2連続正解で100%。要復習度は直近2学習日の初回回答と経過日数から計算します。</p>
        <p>元の設問文脈を保ち、試験当時の正答を使います。現在の法律と一致するかは未確認です。独自解説の登録がないカードでは、判定根拠のみ表示します。</p>
        <p>真偽を確定できない選択肢は出題しません（除外記録 {swipeCatalog.excluded.length}件）。</p>
      </details>
        </div>;
  if (!active) return home && homeHost ? createPortal(setup, homeHost) : null;
  return <section className="swipe-screen">
    {!card ? <div className="swipe-empty"><p>ホームで年度・分野を選択してください。</p><button className="primary" onClick={onBack}>条件選択に戻る<span aria-hidden="true">→</span></button></div> : <>
      <div className="quest-heading"><button className="text-button" onClick={() => { setCard(undefined); setResult(undefined); locked.current = false; setNow(Date.now()); onBack(); }}>分野選択に戻る</button></div>
      <div className="question-meta"><span>{card.year}年度 問{card.number}・選択肢{card.choiceId}</span></div>
      <p className="swipe-topic">{card.topicIds.map(id => swipeConcepts.find(c => c.id === id)?.label).join(' / ') || '分類待ち'}</p>
      <div className="swipe-context"><b>元の設問</b><p><GlossaryText key={`${card.id}:${deal}:stem`} text={card.stem} requireConfirmation={requireHintConfirmation} onHintUsed={useHint}/></p></div>
      {!result && hintUsed && <p className="hint-record-note" role="status">用語解説を閲覧済み：今回は不正解として記録します。</p>}
      <div className={`swipe-surface${result ? ' swipe-surface-feedback' : ''}`} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => { gesture.current = undefined; setDrag({ x: 0, y: 0 }); }} onLostPointerCapture={() => { gesture.current = undefined; setDrag({ x: 0, y: 0 }); }}
        onKeyDown={e => { if (['ArrowRight','ArrowLeft','ArrowUp'].includes(e.key)) { e.preventDefault(); if (e.repeat) return; if (result) next(); else submit(e.key === 'ArrowUp' ? null : e.key === 'ArrowRight'); } }}>
      <div className="swipe-card-deal" key={`${card.id}:${deal}`}>
      <div ref={cardRef} className={`swipe-card ${drag.x || drag.y ? 'is-dragging' : ''} ${result ? result.correct ? 'swipe-correct' : 'swipe-wrong' : ''}`} tabIndex={0} role="group" aria-label="○×カード"
        data-intent={drag.y < 0 ? 'unknown' : drag.x > 0 ? 'yes' : drag.x < 0 ? 'no' : undefined}
        style={{ transform: `translate(${drag.x}px, ${drag.y}px) rotate(${drag.x / 20}deg)` }}>
        <span className="card-eyebrow" aria-hidden="true">TRUE / FALSE</span>
        <p><GlossaryText text={card.text} requireConfirmation={requireHintConfirmation} onHintUsed={useHint}/></p>
        {result && <span className={`card-verdict ${result.correct ? 'mint' : 'coral'}`} aria-hidden="true">{result.correct ? '✓' : '×'}</span>}
        {(drag.x !== 0 || drag.y !== 0) && <span className={`swipe-stamp ${drag.x > 0 ? 'mint' : 'coral'}`} aria-hidden="true">{drag.y < 0 ? '？' : drag.x > 0 ? '○' : '×'}</span>}
      </div>
      </div>
      {result && <div key={`${card.id}:${deal}:result`} className={`swipe-celebration ${result.correct ? 'correct' : 'wrong'}`} aria-hidden="true"><span className={`swipe-effect ${result.correct ? 'correct' : 'wrong'}`}>{result.correct ? '○' : '×'}</span>{result.correct && Array.from({length:8}, (_,i) => <i key={i} style={{'--angle':`${i * 45}deg`} as CSSProperties}/>)}</div>}
      {!result ? <><div className="swipe-actions"><button className="secondary swipe-no" aria-label="×と答える" disabled={blocked} onClick={() => submit(false)}>← ×</button><button className="primary swipe-yes" aria-label="○と答える" disabled={blocked} onClick={() => submit(true)}>○ →</button></div><button className="secondary" onClick={() => submit(null)} disabled={blocked}>↑ わからない</button></> : <>
        <div id="swipe-feedback" className={`feedback ${result.correct ? 'success' : 'miss'}`} role="status">
          <h2>{result.correct ? '正解！' : '不正解'} <small>+{result.xp} XP</small></h2><p className="swipe-verdict">正答：<b>{card.truth ? '○' : '×'}</b> ／ あなた：{result.answer === null ? 'わからない' : result.answer ? '○' : '×'}</p>
          <p>{card.explanation || '解説未登録'}</p>
          {hintUsed && <p className="hint-record-note">回答前に用語解説を見たため、学習記録は不正解扱いです。</p>}
        </div>
        <button className="primary" ref={nextRef} onClick={next}>次のカードへ<span aria-hidden="true">→</span></button>
         <button className="secondary" onClick={retry}>同じカードを再練習（XPなし）</button>
      </>}
      </div>
      {questionById(card.questionId) && <CopyText key={`${card.id}:${Boolean(result)}`} text={swipeCopyText(questionById(card.questionId)!, card, Boolean(result), result?.answer)} includeAnswer={Boolean(result)}/>}
      {result && <>
        <AppExplanation key={`${card.id}:${card.revision}`} target={cardTarget(card)}/>
        <details className="panel"><summary>問題・出典</summary><p>次の復習：{state.progress[card.id] ? new Date(state.progress[card.id].dueAt).toLocaleString('ja-JP') : '未記録'}</p>
          <ol>{questionById(card.questionId)?.options.map(o => <li key={o.id}>{o.text}</li>)}</ol>
          {questionById(card.questionId)?.original?.imagePath && <><button className="secondary" onClick={() => setOriginal(!original)}>{original ? '原本を閉じる' : '原本画像を見る'}</button>{original && <OriginalImage question={questionById(card.questionId)!}/>}</>}
          {questionById(card.questionId)?.original?.sourceUrl && <a href={questionById(card.questionId)!.original!.sourceUrl} target="_blank" rel="noopener noreferrer">掲載元で確認 ↗</a>}
          <p className="fine-print">文字の独立した再校正・現行法への適合性確認は未完了です。</p>
        </details>
      </>}
    </>}
  </section>;
}
