import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { availableYears, questionById } from '../data/provider';
import { swipeCards, swipeCardById, swipeCategories, swipeConcepts, swipeCatalog } from '../data/swipe-provider';
import { emptySwipe, filterSwipeCards, progressFor, recordSwipe, reviewQueue, type SwipeCard, type SwipeState } from '../domain/swipe';
import { loadSwipe, parseSwipe, SWIPE_IMPORT_BYTES, SWIPE_STORAGE_KEY } from '../domain/swipeStorage';
import { OriginalImage } from './OriginalImage';
import { CopyText } from './CopyQuestion';
import { AppExplanation } from './AppExplanation';
import { cardTarget } from '../domain/appExplanation';
import { swipeCopyText } from '../domain/questionCopy';

function download(text: string, name: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function SwipeStudy({ active }: { active: boolean }) {
  const [initial] = useState(() => {
    try { return loadSwipe(window.localStorage, swipeCardById); }
    catch { return { state: emptySwipe(), raw: undefined, error: 'このブラウザの○×保存領域を利用できません。' }; }
  });
  const [state, setState] = useState(initial.state);
  const [blocked, setBlocked] = useState(Boolean(initial.error));
  const [error, setError] = useState(initial.error);
  const [year, setYear] = useState<number | 'all'>('all');
  const [topic, setTopic] = useState('all');
  const [now, setNow] = useState(Date.now());
  const [queue, setQueue] = useState<SwipeCard[]>([]);
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState<{ answer: boolean | null; correct: boolean }>();
  const [score, setScore] = useState(0);
  const [summary, setSummary] = useState('');
  const [drag, setDrag] = useState({ x: 0, y: 0 });
  const [original, setOriginal] = useState(false);
  const [preview, setPreview] = useState<SwipeState>();
  const [message, setMessage] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const gesture = useRef<{ x: number; y: number; id: number; phase: 'answer' | 'feedback' } | undefined>(undefined);
  const locked = useRef(false);
  const nextRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const card = queue[index];
  const candidates = useMemo(() => filterSwipeCards(swipeCards, year, topic), [year, topic]);
  const available = useMemo(() => reviewQueue(candidates, state, now), [candidates, state, now]);
  const counts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of filterSwipeCards(swipeCards, year, 'all')) { const id = c.topicId ?? 'unclassified'; counts.set(id, (counts.get(id) ?? 0) + 1); }
    return counts;
  }, [year]);
  const reviewed = candidates.filter(c => progressFor(state, c)).length;
  const due = available.filter(c => progressFor(state, c)).length;
  const nextDue = candidates.map(c => progressFor(state, c)?.dueAt).filter((d): d is string => Boolean(d)).sort()[0];
  useEffect(() => {
    if (blocked) return;
    try { window.localStorage.setItem(SWIPE_STORAGE_KEY, JSON.stringify(state)); setError(undefined); }
    catch { setError('○×履歴を保存できません。タブを閉じる前に○×履歴を書き出してください。'); }
  }, [state, blocked]);
  useEffect(() => { if (!active) return; setNow(Date.now()); const timer = setInterval(() => setNow(Date.now()), 15_000); return () => clearInterval(timer); }, [active]);
  const submit = (answer: boolean | null) => {
    if (!card || blocked || result || locked.current) return;
    locked.current = true;
    const correct = answer !== null && answer === card.truth;
    setState(s => recordSwipe(s, card, answer, Date.now()));
    setResult({ answer, correct }); setScore(s => s + Number(correct)); setDrag({ x: 0, y: 0 });
    requestAnimationFrame(() => { nextRef.current?.focus({ preventScroll: true }); document.getElementById('swipe-feedback')?.scrollIntoView({ block: 'start', behavior: 'instant' }); });
  };
  const next = () => {
    if (!result) return;
    if (!locked.current) return;
    locked.current = false; setResult(undefined); setOriginal(false); setDrag({ x: 0, y: 0 }); setNow(Date.now());
    if (index + 1 === queue.length) { setSummary(`${queue.length}枚中 ${score}枚正解`); setQueue([]); setIndex(0); }
    else { setIndex(i => i + 1); requestAnimationFrame(() => cardRef.current?.focus({ preventScroll: true })); }
    window.scrollTo({ top: 0, behavior: 'instant' });
  };
  const start = () => {
    const next = reviewQueue(candidates, state, Date.now()).slice(0, 20);
    if (!next.length || blocked) return;
    locked.current = false; setQueue(next); setIndex(0); setScore(0); setResult(undefined); setSummary(''); setOriginal(false);
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
    if (g.phase === 'feedback') { if (result) next(); }
    else if (!result) submit(upward ? null : dx > 0);
  };
  const importFile = async (file?: File) => {
    if (!file) return;
    try { if (file.size > SWIPE_IMPORT_BYTES) throw new Error('○×履歴は4MB以内にしてください。'); setPreview(parseSwipe(await file.text(), swipeCardById)); setMessage(''); }
    catch (e) { setMessage(e instanceof Error ? e.message : '○×履歴を読み取れません。'); }
    if (fileRef.current) fileRef.current.value = '';
  };
  if (!active) return null;
  return <section className="swipe-screen">
    {!card && <h1>○×学習</h1>}
    {error && <div className="warning" role="alert"><p>{error}</p>{blocked && <>
      <button onClick={() => download(initial.raw ?? '', 'care-manager-swipe-recovery.json')}>元の○×データを書き出す</button>
      <button onClick={() => { setBlocked(false); setState(emptySwipe()); }}>新しい○×履歴で始める</button>
    </>}</div>}
    {message && <p role="status">{message}</p>}
    {!card ? <>
      {summary && <p className="notice" role="status">{summary}</p>}
      <div className="panel swipe-settings">
        <label>年度<select aria-label="○×の年度" value={year} onChange={e => { setYear(e.target.value === 'all' ? 'all' : Number(e.target.value)); setTopic('all'); }}>
          <option value="all">全年度</option>{availableYears.map(y => <option key={y} value={y}>{y}年度</option>)}
        </select></label>
        <label>分野<select aria-label="学ぶ知識分野" value={topic} onChange={e => setTopic(e.target.value)}>
          <option value="all">全分野</option><option value="unclassified">分類待ち（{counts.get('unclassified') ?? 0}枚）</option>
          {swipeCategories.map(category => {
            const concepts = swipeConcepts.filter(c => c.categoryId === category.id && counts.has(c.id));
            return concepts.length ? <optgroup key={category.id} label={category.label}>{concepts.map(c => <option key={c.id} value={c.id}>{c.label}（{counts.get(c.id)}枚）</option>)}</optgroup> : null;
          })}
        </select></label>
        <div className="record-stats"><div><b>{candidates.length}</b><span>対象</span></div><div><b>{reviewed}</b><span>学習済み</span></div><div><b>{due}</b><span>復習待ち</span></div></div>
        <button className="primary" aria-label="○×学習を始める" disabled={blocked || !available.length} onClick={start}>はじめる<span aria-hidden="true">→</span></button>
        <p className="mission-note">1回20枚まで</p>
        {!available.length && <p role="status">今の分野のカードは学習済みです。{nextDue && <>次の復習：{new Date(nextDue).toLocaleString('ja-JP')}</>} 年度・分野を変えると学習を続けられます。</p>}
      </div>
      <details className="panel"><summary>使い方</summary><p>右で○、左で×、上で「わからない」。解説を読んだら、もう一度スワイプで次へ。</p>
        <p>誤答は1分後、正解は連続正解数に応じて1・3・7・14・30・60日後に復習します。先に誤答、次に期限が来た正解、最後に未学習のカードを出題します。</p>
        <p>元の設問文脈を保ち、試験当時の正答を使います。現在の法律と一致するかは未確認です。独自解説の登録がないカードでは、判定根拠のみ表示します。</p>
        <p>真偽を確定できない選択肢は出題しません（除外記録 {swipeCatalog.excluded.length}件）。</p>
      </details>
      <details className="panel"><summary>○×履歴</summary>
        <button className="secondary" disabled={blocked} onClick={() => download(JSON.stringify(state, null, 2), 'care-manager-swipe-history.json')}>○×履歴を書き出す</button>
        <button className="secondary" onClick={() => fileRef.current?.click()}>○×履歴を読み込む</button>
        <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={e => void importFile(e.target.files?.[0])}/>
      </details>
    </> : <>
      <div className="quest-heading"><button className="text-button" onClick={() => { setQueue([]); setResult(undefined); locked.current = false; setNow(Date.now()); }}>分野選択に戻る</button><span>{index + 1} / {queue.length}枚</span></div>
      <div className="question-meta"><span>{card.year}年度 問{card.number}・選択肢{card.choiceId}</span></div>
      <p className="swipe-topic">{swipeConcepts.find(c => c.id === card.topicId)?.label ?? '分類待ち'}</p>
      <div className="swipe-context"><b>元の設問</b><p>{card.stem}</p></div>
      <div className="swipe-surface" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => { gesture.current = undefined; setDrag({ x: 0, y: 0 }); }} onLostPointerCapture={() => { gesture.current = undefined; setDrag({ x: 0, y: 0 }); }}
        onKeyDown={e => { if (['ArrowRight','ArrowLeft','ArrowUp'].includes(e.key)) { e.preventDefault(); if (e.repeat) return; if (result) next(); else submit(e.key === 'ArrowUp' ? null : e.key === 'ArrowRight'); } }}>
      <div ref={cardRef} className={`swipe-card ${result ? result.correct ? 'swipe-correct' : 'swipe-wrong' : ''}`} tabIndex={0} role="group" aria-label="○×カード"
        style={{ transform: `translate(${drag.x}px, ${drag.y}px) rotate(${drag.x / 20}deg)` }}>
        <p>{card.text}</p>
        {(drag.x !== 0 || drag.y !== 0) && <span className={`swipe-stamp ${drag.x > 0 ? 'mint' : 'coral'}`} aria-hidden="true">{drag.y < 0 ? '？' : drag.x > 0 ? '○' : '×'}</span>}
      </div>
      {result && <span key={card.id} className={`swipe-effect ${result.correct ? 'correct' : 'wrong'}`} aria-hidden="true">{result.correct ? '○' : '×'}</span>}
      {!result ? <><div className="swipe-actions"><button className="secondary swipe-no" aria-label="×と答える" disabled={blocked} onClick={() => submit(false)}>← ×</button><button className="primary swipe-yes" aria-label="○と答える" disabled={blocked} onClick={() => submit(true)}>○ →</button></div><button className="secondary" onClick={() => submit(null)} disabled={blocked}>↑ わからない</button></> : <>
        <div id="swipe-feedback" className={`feedback ${result.correct ? 'success' : 'miss'}`} role="status">
          <h2>{result.correct ? '正解！' : '不正解'}</h2><p className="swipe-verdict">正答：<b>{card.truth ? '○' : '×'}</b> ／ あなた：{result.answer === null ? 'わからない' : result.answer ? '○' : '×'}</p>
          <p>{card.explanation || '解説未登録'}</p>
        </div>
        <button className="primary" ref={nextRef} onClick={next}>{index + 1 === queue.length ? '学習結果を見る' : '次のカードへ'}<span aria-hidden="true">→</span></button>
      </>}
      </div>
      {questionById(card.questionId) && <CopyText key={`${card.id}:${Boolean(result)}`} text={swipeCopyText(questionById(card.questionId)!, card, Boolean(result), result?.answer)} includeAnswer={Boolean(result)}/>}
      {result && <>
        <AppExplanation key={`${card.id}:${card.revision}`} target={cardTarget(card)}/>
        <details className="panel"><summary>問題・出典</summary><p>次の復習：{new Date(state.progress[card.id].dueAt).toLocaleString('ja-JP')}</p>
          <ol>{questionById(card.questionId)?.options.map(o => <li key={o.id}>{o.text}</li>)}</ol>
          {questionById(card.questionId)?.original?.imagePath && <><button className="secondary" onClick={() => setOriginal(!original)}>{original ? '原本を閉じる' : '原本画像を見る'}</button>{original && <OriginalImage question={questionById(card.questionId)!}/>}</>}
          {questionById(card.questionId)?.original?.sourceUrl && <a href={questionById(card.questionId)!.original!.sourceUrl} target="_blank" rel="noopener noreferrer">掲載元で確認 ↗</a>}
          <p className="fine-print">{card.topicId ? '単一論点の問題から引き継いだ暫定分類です。' : 'この選択肢の知識分類は未確認です。'} 文字の独立した再校正・現行法への適合性確認は未完了です。</p>
        </details>
      </>}
    </>}
    {preview && <section className="panel" aria-label="○×履歴の読み込み確認"><h2>○×履歴の読み込み確認</h2><p>{Object.keys(preview.progress).length}枚の復習記録で、現在の○×履歴を置き換えます。</p>
      <button className="secondary" onClick={() => download(initial.raw && blocked ? initial.raw : JSON.stringify(state, null, 2), 'care-manager-swipe-before-import.json')}>現在の○×データを書き出す</button>
      <button className="primary" onClick={() => { setState(preview); setBlocked(false); setPreview(undefined); setQueue([]); setResult(undefined); setNow(Date.now()); setMessage('○×履歴を読み込みました。'); }}>○×履歴を置き換える</button>
      <button className="secondary" onClick={() => setPreview(undefined)}>キャンセル</button>
    </section>}
  </section>;
}
