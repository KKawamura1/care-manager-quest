import { BundledExplanation } from './components/BundledExplanation';
import { aggregateKnowledgeLevel, knowledgeProgress } from './domain/knowledgeProgress';
import { useEffect, useMemo, useRef, useState } from 'react';
import { concepts } from './data/knowledge';
import { studyScope } from './data/study-scope';
import { parseStudyScope } from './domain/studyScope';
import { StudyScopePicker } from './components/StudyScopePicker';
import { questions, questionById, availableYears } from './data/provider';
import { sources, officialNotice } from './data/sources';
import { advance, buildSession, conceptStatus, continueSession, emptyPlayer, levelInfo, practiceScore, submitAnswer, totalXp } from './domain/game';
import { loadPlayer, MAX_IMPORT_BYTES, parsePlayer, savePlayer, STORAGE_KEY, validExternalUrl } from './domain/storage';
import type { PlayerState, Question } from './domain/models';
import { Modal } from './components/Modal';
import { GlossaryText } from './components/GlossaryText';
import { OriginalImage } from './components/OriginalImage';
import { CopyQuestion } from './components/CopyQuestion';
import { AppExplanation } from './components/AppExplanation';
import { questionTarget } from './domain/appExplanation';
import { SwipeStudy } from './components/SwipeStudy';
import { FieldStats } from './components/FieldStats';
import { DailyProgress, DailyProgressPreview } from './components/DailyProgress';
import { KnowledgeMap } from './components/KnowledgeMap';
import { KnowledgeLevel, formatKnowledgeLevel } from './components/KnowledgeLevel';
import { learningCorrect, recordLearning } from './domain/learning';
import { swipeCardById } from './data/swipe-provider';
import { filterQuestions, parseYearFilter, YEAR_STORAGE_KEY, type YearFilter } from './domain/questionFilter';
const DOMAIN_OPTIONS = [
  {value:'介護支援分野',label:'介護支援'},
  {value:'保健医療サービスの知識等',label:'保健医療'},
  {value:'福祉サービスの知識等',label:'福祉'},
  {value:'all',label:'全分野'},
] as const;
type DomainFilter = typeof DOMAIN_OPTIONS[number]['value'];
const DOMAIN_STORAGE_KEY = 'care-manager-quest:domain-filter';
const SCOPE_STORAGE_KEY = 'care-manager-quest:quest-scope';
const statusLabel = { unexplored: '未探索', learning: '学習中', mastered: '習得済み' };
function download(text: string, name: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url),1000);
}
function initiallyLoad() {
 try {
  const result=loadPlayer(window.localStorage);
  if(result.migrated && result.raw) {
   try {if(!window.localStorage.getItem(STORAGE_KEY+':before-official'))window.localStorage.setItem(STORAGE_KEY+':before-official',result.raw);}
   catch {return {...result,error:'移行前の履歴を退避できません。元データを書き出してから履歴を読み込んでください。'};}
  }
  return result;
 } catch {return {player:emptyPlayer(),error:'このブラウザの保存領域を利用できません。JSONで履歴を保存できます。',migrated:false};}
}

export default function App() {
  useEffect(() => {
    // Dialogs restore focus programmatically, which can leave :focus-visible
    // active after a tap in WebKit. Keep rings for keyboard navigation only.
    const root = document.documentElement;
    const pointer = () => { root.dataset.inputMethod = 'pointer'; };
    const keyboard = (event: KeyboardEvent) => {
      if (!['Shift', 'Control', 'Alt', 'Meta'].includes(event.key)) delete root.dataset.inputMethod;
    };
    document.addEventListener('pointerdown', pointer, true);
    document.addEventListener('keydown', keyboard, true);
    return () => {
      document.removeEventListener('pointerdown', pointer, true);
      document.removeEventListener('keydown', keyboard, true);
      delete root.dataset.inputMethod;
    };
  }, []);
  const [domainFilter,setDomainFilter] = useState<DomainFilter>(()=>{
    try {const stored=window.localStorage.getItem(DOMAIN_STORAGE_KEY); return DOMAIN_OPTIONS.some(option=>option.value===stored)?stored as DomainFilter:'all';}
    catch {return 'all';}
  });
  const [yearFilter,setYearFilter] = useState<YearFilter>(()=>{try{return parseYearFilter(window.localStorage.getItem(YEAR_STORAGE_KEY));}catch{return 2025;}});
  const [scope, setScope] = useState(() => {try{return parseStudyScope(window.localStorage.getItem(SCOPE_STORAGE_KEY),studyScope);}catch{return 'all';}});
  const baseQuestions = useMemo(() => filterQuestions(questions,yearFilter,domainFilter),[yearFilter,domainFilter]);
  const scopeCounts = useMemo(() => studyScope.counts(baseQuestions.map(q => ({topicIds:q.conceptIds}))),[baseQuestions]);
  const activeQuestions = useMemo(() => baseQuestions.filter(q => studyScope.matches(q.conceptIds,scope)),[baseQuestions,scope]);
  const questSize = Math.min(5,activeQuestions.length);
  const changeScope = (next:string) => {setScope(next);try{window.localStorage.setItem(SCOPE_STORAGE_KEY,next);}catch{/* continue without persistence */}};
  const changeYear=(next:YearFilter)=>{setYearFilter(next);try{window.localStorage.setItem(YEAR_STORAGE_KEY,String(next));}catch{/* continue without persistence */}};
  const changeDomain = (next: DomainFilter) => {setDomainFilter(next);try{window.localStorage.setItem(DOMAIN_STORAGE_KEY,next);}catch{/* continue without persistence */}};
  const [initial] = useState(initiallyLoad);
  const [player, setPlayer] = useState<PlayerState>(initial.player);
  const [blocked, setBlocked] = useState(Boolean('raw' in initial && initial.raw && initial.error));
  const [saveError, setSaveError] = useState(initial.error);
  const [route, setRoute] = useState<'home'|'quest'|'play'|'records'|'swipe-setup'|'swipe'>(initial.player.session ? 'play' : 'home');
  const [detail, setDetail] = useState<Question>();
  const [conceptId, setConceptId] = useState<string>();
  const [importPreview, setImportPreview] = useState<PlayerState>();
  const [notice, setNotice] = useState(initial.migrated?'以前の履歴・XPを引き継ぎました。旧問題の途中クエストを終了し、2025年度の公式過去問に切り替えました。':'');
  const [originalQuestion,setOriginalQuestion]=useState<Question>();
  const [returnDetail,setReturnDetail]=useState<Question>();
  const fileRef = useRef<HTMLInputElement>(null);
  const xp = totalXp(player), level = levelInfo(xp), session = player.session;
  const current = session ? questionById(session.questionIds[session.index]) : undefined;
  const attempt = session ? player.attempts.find(a => a.id === `${session.id}:${session.index}`) : undefined;
  const detailAnswered = Boolean(detail && player.attempts.some(a => a.questionId === detail.id && a.questionVersion === detail.version));
  const detailText = (text: string) => detailAnswered ? <GlossaryText text={text}/> : text;
  const inSession = session ? player.attempts.filter(a => a.sessionId === session.id) : [];
  const resultScore = session ? practiceScore(session, player.attempts) : { correct: 0, total: 0 };
  const selected = session?.selectedIds ?? [];
  const mapProgress = useMemo(() => knowledgeProgress(player, questions), [player]);
  const explored = concepts.filter(c => conceptStatus(mapProgress[c.id]) !== 'unexplored').length;
  const mastered = concepts.filter(c => conceptStatus(mapProgress[c.id]) === 'mastered').length;
  const activeConcept = concepts.find(c=>c.id===conceptId);
  useEffect(() => {
    if (blocked) return;
    try { setSaveError(savePlayer(window.localStorage, player)); }
    catch { setSaveError('履歴を保存できません。JSONを書き出してください。'); }
  }, [player, blocked]);
  const go = (next: typeof route) => { setRoute(next); window.scrollTo({top:0,behavior:'instant'}); };
  const start = (continueRun = false) => {
    if (blocked || !activeQuestions.length) return;
    setPlayer(p=>({
      ...p,
      session: continueRun
        ? continueSession(activeQuestions,p,crypto.randomUUID())
        : buildSession(activeQuestions,p.attempts,crypto.randomUUID()),
    }));
    go('play'); setNotice('');
  };
  const choose = (id: string) => {
    if (!session || attempt) return;
    setPlayer(p=>{
      const s = p.session!;
      const ids = s.selectedIds.includes(id) ? s.selectedIds.filter(x=>x!==id) : s.selectedIds.length < current!.selectionCount ? [...s.selectedIds,id] : s.selectedIds;
      return {...p,session:{...s,selectedIds:ids}};
    });
  };
  const answer = () => {
    const next = submitAnswer(player,questions,new Date().toISOString());
    if (next === player) return;
    setPlayer(next);
    requestAnimationFrame(()=>document.getElementById('feedback')?.scrollIntoView({block:'start',behavior:'instant'}));
  };
  const nextQuestion = () => { setPlayer(advance); window.scrollTo({top:0,behavior:'instant'}); };
  async function readImport(file?: File) {
    if (!file) return;
    try {
      if (file.size > MAX_IMPORT_BYTES) throw new Error('履歴ファイルは20MB以内にしてください。');
      setImportPreview(parsePlayer(await file.text())); setNotice('');
    } catch (e) { setNotice(e instanceof Error ? e.message : '読み込みに失敗しました。'); }
    if (fileRef.current) fileRef.current.value = '';
  }
  const headline = <>Care Manager Quest</>;
  return <div className="app-shell">
    <header className="app-header"><button className="brand" aria-label="冒険ホームへ" onClick={()=>go('home')}>{headline}</button><button className="sound-button" aria-label={`効果音を${player.settings.sound?'オフ':'オン'}にする`} aria-pressed={player.settings.sound} onClick={()=>setPlayer(p=>({...p,settings:{sound:!p.settings.sound}}))}>{player.settings.sound?'♪':'♪̸'}<span>{player.settings.sound?'ON':'OFF'}</span></button></header>
    {route !== 'quest' && route !== 'play' && <div className="player-bar"><span className="level-chip">Lv. <b>{level.level}</b></span><div className="xp-track"><div className="meter" aria-label={`次のレベルまで ${level.next} XP`}><i style={{width:`${level.current/2}%`}}/></div></div><span className="xp-value">{level.current} / 200 XP</span></div>}
    {saveError && <div className="warning" role="alert"><p>{saveError}</p>{blocked && <><button onClick={()=>download(('raw' in initial && initial.raw) || '', 'care-manager-quest-recovery.json')}>元のデータを書き出す</button><button onClick={()=>{setBlocked(false);setPlayer(emptyPlayer());setSaveError(undefined);}}>新しい履歴で始める</button></>}</div>}
    {notice && <p className="notice" role="status">{notice}</p>}
    <main>
      <SwipeStudy active={route === 'swipe'} home={route === 'home' || route === 'swipe-setup'} onStart={()=>go('swipe')} onBack={()=>go('swipe-setup')} learningEvents={player.learningEvents} blocked={blocked} onAnswer={(card, answer, at, hintUsed)=>setPlayer(p=>({...p, learningEvents:recordLearning(p.learningEvents,[{card,answer,hintUsed}],at,'swipe')}))}/>
      {(route === 'home' || route === 'quest' || route === 'swipe-setup') && <>
        <section className="home-screen">
          {route === 'home' && <DailyProgressPreview events={player.learningEvents} onOpen={()=>go('records')}/>}
          {route !== 'quest' && <section className="mission-card swipe-home-card" id="swipe-home-setup" aria-label="○×学習の設定"/>}
          {route !== 'swipe-setup' && <section className="mission-card">
            <h2>過去問演習</h2>
            <label className="year-picker">年度<select aria-label="出題する年度" value={yearFilter} onChange={e=>changeYear(parseYearFilter(e.target.value))}><option value="all">全年度</option>{availableYears.map(year=><option key={year} value={year}>{year}年度</option>)}</select></label>
            <StudyScopePicker value={scope} onChange={changeScope} counts={scopeCounts} mode="5択" unit="問"/>
            <details className="exam-field-filter"><summary>試験分野でさらに絞る</summary><fieldset className="domain-picker"><legend>試験分野</legend>{DOMAIN_OPTIONS.map(option=><label key={option.value}><input type="radio" name="quest-domain" aria-label={`${option.label}（${questions.filter(q=>(yearFilter==='all'||q.original?.year===yearFilter)&&(option.value==='all'||q.domain===option.value)).length}問）`} checked={domainFilter===option.value} onChange={()=>changeDomain(option.value)}/><span>{option.label}</span></label>)}</fieldset></details>
            <p className="mission-note">{activeQuestions.length}問対象 · 1回{questSize}問</p>
            {!activeQuestions.length && <p role="status">今の条件に該当する問題はありません。年度・分類・試験分野を変更してください。</p>}
            {session&&!session.completed&&<p className="mission-note">設定は次の演習から反映</p>}
            <button className="primary" aria-label={session&&!session.completed?`第${session.index+1}問から再開`:`${questSize}問の演習を始める`} disabled={blocked||(!(session&&!session.completed)&&!activeQuestions.length)} onClick={session&&!session.completed?()=>go('play'):()=>start()}>{session&&!session.completed?`第${session.index+1}問から再開`:`${questSize}問の演習を始める`}<span aria-hidden="true">→</span></button>
          </section>}
        </section>
      </>}
      {route === 'play' && current && session && !session.completed && <section className="play-screen">
        <div className="quest-heading"><button className="text-button" onClick={()=>go('home')} aria-label="中断してホーム">‹ ホーム</button><span>{session.index+1} / {session.questionIds.length}</span></div>
        <div className="question-progress">{session.questionIds.map((id,i)=>{const a=inSession[i];return <span key={id} className={i===session.index?'current':a?a.correct?'won':'lost':''}>{a?(a.correct?'✓':'·'):i+1}</span>;})}</div>
        <h1 className="question-title">{current.title}</h1><p className="question-stem">{attempt ? <GlossaryText key={current.id} text={current.stem}/> : current.stem}</p>
        <div className="selection-instruction"><b>{current.selectionCount}つ選択</b><span>{attempt?'解答済み':`${selected.length} / ${current.selectionCount} 選択中`}</span></div>
        <div className="options" role="group" aria-label="解答の選択肢">{current.options.map((o,i)=>{
          const chosen=selected.includes(o.id), correct=attempt&&(current.answerVariants??[current.answerIds]).some(ids=>ids.includes(o.id)), wrong=attempt&&chosen&&!correct;
          const className = `option ${chosen?'selected':''} ${correct?'correct':''} ${wrong?'wrong':''}`;
          const content = <><span className="option-number">{attempt?(correct?'✓':wrong?'×':i+1):i+1}</span><span>{attempt ? <GlossaryText text={o.text}/> : o.text}{attempt&&<small>{correct?(current.answerVariants&&!chosen?'他の正答の組合せに含まれる':'正答'):wrong?'選択した誤答':chosen?'あなたの選択':'不正解の選択肢'}</small>}</span><span className="check-box" aria-hidden="true">{chosen?'✓':''}</span></>;
          return attempt ? <div key={o.id} className={className} role="group" aria-label={`選択肢${o.id}${chosen ? '：あなたの選択' : ''}`}>{content}</div> :
            <button key={o.id} className={className} aria-pressed={chosen} onClick={()=>choose(o.id)}>{content}</button>;
        })}</div>
        {!attempt&&<CopyQuestion key={current.id} question={current}/>}
        {current.original&&<div className="question-tools">{current.original.imagePath?<button className="text-button" onClick={()=>setOriginalQuestion(current)}>原本画像を見る ↗</button>:<a href={current.provenance.pastExamUrl??current.original.sourceUrl} target="_blank" rel="noopener noreferrer">掲載元で問題を確認 ↗</a>}</div>}
        {attempt && <section id="feedback" className={`feedback ${attempt.correct?'success':'miss'}`} role="status"><div className="feedback-top"><h2>{attempt.correct?'正解':'不正解'}</h2></div><BundledExplanation key={current.id} question={current} fallback={current.explanation}/><p className="answer-key">正答：{(current.answerVariants??[current.answerIds]).map(ids=>ids.join('・')).join(' または ')} ／ あなたの選択：{attempt.selectedIds.join('・')}</p></section>}
        {attempt&&<CopyQuestion key={current.id} question={current} includeAnswer selectedIds={attempt.selectedIds}/>}
        {attempt&&<AppExplanation key={`${current.id}:${current.version}`} target={questionTarget(current)}/>}
        <div className="answer-dock">{attempt?<><button className="primary" onClick={nextQuestion}>{session.index===session.questionIds.length-1?'結果を見る':'次の問題へ'}<span>→</span></button><button className="secondary" onClick={()=>setDetail(current)}>詳しく見る</button></>:<button className="primary" disabled={selected.length!==current.selectionCount||blocked} onClick={answer}>{selected.length===current.selectionCount?'答えを確定する':`あと${current.selectionCount-selected.length}つ選んでください`}<span>→</span></button>}</div>
      </section>}
      {route === 'play' && session?.completed && <section className="result-screen"><h1>演習結果</h1><div className="result-score"><strong>{resultScore.correct}<small>/ {resultScore.total}</small></strong><span>累計正答率 {Math.round(resultScore.correct / resultScore.total * 100)}%</span></div><p className="result-batch-label">直近{inSession.length}問の結果</p><div className="result-list">{inSession.map(a=><button key={a.id} onClick={()=>setDetail(questionById(a.questionId))}><span className={a.correct?'mint':'coral'}>{a.correct?'✓':'×'}</span><span>{questionById(a.questionId)?.title}</span><small>{a.correct?'正解':'不正解'}</small></button>)}</div><button className="primary" onClick={()=>start(true)} disabled={blocked||!activeQuestions.length} aria-label={`もう${questSize}問解く`}>もう{questSize}問解く<span>→</span></button><button className="secondary" onClick={()=>{go('records');requestAnimationFrame(()=>document.getElementById('record-map')?.scrollIntoView({block:'start',behavior:'instant'}));}} aria-label="知識マップを見る">知識マップ</button></section>}
      {route === 'records' && <section className="records-screen"><h1>記録</h1>
        <nav className="record-shortcuts" aria-label="記録のセクション"><a href="#record-progress">積み上げ</a><a href="#record-map">知識マップ</a><a href="#record-fields">得意・苦手</a></nav>
        <div id="record-progress"><DailyProgress events={player.learningEvents}/></div>
        <section id="record-map" className="record-map" aria-labelledby="record-map-title"><h2 id="record-map-title">知識マップ</h2><div className="map-summary"><b>{explored}<small> / {concepts.length}</small></b><span>探索した知識</span><b>{mastered}<small> 習得</small></b></div><div className="map-legend"><span>○ 未探索</span><span className="gold">◐ 学習中</span><span className="mint">● 習得済み</span></div>
        <div className="map-level-summary"><span>全体の学習レベル</span><KnowledgeLevel level={aggregateKnowledgeLevel(concepts.map(c => c.id), mapProgress)} label="全体"/></div>
        <KnowledgeMap progress={mapProgress} onSelect={setConceptId}/>
        <details className="help-details"><summary>習得の目安</summary><p>各選択肢は1回正解で約67%、別の日に2連続正解で100%になり、各階層のゲージに反映されます。直近2学習日の初回回答を重み付きで評価し、未回答分は0として集約します。上位分類は配下の引き出しの平均です。学習レベル80%以上で習得済み。同日の再練習は加算せず、時間経過は要復習度に反映します。</p></details>
        </section>
        <div id="record-fields"><FieldStats events={player.learningEvents}/></div><div className="record-stats"><div><b>{player.learningEvents.length}</b><span>回答した選択肢</span></div><div><b>{xp}</b><span>合計XP</span></div><div><b>{player.learningEvents.filter(e=>learningCorrect(e,swipeCardById.get(e.cardId))).length}</b><span>正解</span></div></div><section className="panel"><h2>履歴を持ち出す</h2><button className="primary" onClick={()=>download(JSON.stringify(player,null,2),'care-manager-quest-history.json')}>JSONを書き出す <span>↓</span></button><button className="secondary" onClick={()=>fileRef.current?.click()}>JSONを読み込む</button><input type="file" accept=".json,application/json" ref={fileRef} hidden onChange={e=>void readImport(e.target.files?.[0])}/></section>
        <ExternalForm onSave={(url,label,correct)=>{setPlayer(p=>({...p,externalRecords:[...p.externalRecords,{id:crypto.randomUUID(),url,label,correct,at:new Date().toISOString()}]}));setNotice('外部サイトの結果を記録しました。');}} disabled={blocked}/>
        {player.externalRecords.length>0&&<section className="panel"><h2>外部サイトの記録</h2><div className="log-list">{player.externalRecords.slice(-10).reverse().map(e=><div key={e.id}><span className={e.correct?'mint':'coral'}>{e.correct?'✓':'×'}</span><a href={e.url} target="_blank" rel="noopener noreferrer">{e.label} ↗</a><small>{new Date(e.at).toLocaleDateString('ja-JP')}</small></div>)}</div></section>}
        <section className="panel"><h2>最近の探索</h2>{player.attempts.length===0?<p>まだ記録はありません。</p>:<div className="log-list">{player.attempts.slice(-10).reverse().map(a=><button key={a.id} onClick={()=>setDetail(questionById(a.questionId))}><span className={a.correct?'mint':'coral'}>{a.correct?'✓':'×'}</span><span>{questionById(a.questionId)?.title}</span><small>+{a.xp} XP</small></button>)}</div>}</section><details className="help-details"><summary>このアプリについて</summary><p>{officialNotice}</p><p>各年度の試験当時の正答で採点します。現行法・文字の再校正は確認未了、知識分類は暫定です。</p><a href="https://www.sssc.or.jp/pastissues/index.html" target="_blank" rel="noopener noreferrer">過去問題の利用条件 ↗</a></details>
      </section>}
    </main>
    <nav className="bottom-nav" aria-label="メインメニュー">{([['home','◇','冒険'],['swipe-setup','○×','○×学習'],['quest','▤','過去問演習'],['records','≡','記録']] as const).map(([key,icon,label])=>{
      const active = route === key || (key === 'quest' && route === 'play') || (key === 'swipe-setup' && route === 'swipe');
      return <button key={key} aria-label={label} className={active?'active':''} aria-current={active?'page':undefined} onClick={()=>{if(!active)go(key);}}><span aria-hidden="true">{icon}</span>{label}</button>;
    })}</nav>
    {detail&&<Modal title="詳しく見る" onClose={()=>setDetail(undefined)}><div className="detail-content"><h3>{detail.title}</h3>
      <CopyQuestion key={detail.id} question={detail} includeAnswer selectedIds={player.attempts.slice().reverse().find(a=>a.questionId===detail.id)?.selectedIds}/>
      <AppExplanation key={`${detail.id}:${detail.version}`} target={questionTarget(detail)}/>
      {detail.original && <BundledExplanation key={detail.id} question={detail} expanded/>}
      {detail.original?<><p>{detail.original.year}年度試験当時の正答：<b className="mint">{(detail.answerVariants??[detail.answerIds]).map(ids=>ids.join('・')).join(' または ')}</b></p><p className="question-stem">{detailText(detail.stem)}</p>{detail.options.map(o=><p key={o.id}>{o.id}. {detailText(o.text)}</p>)}{detail.original.imagePath&&<OriginalImage key={detail.id} question={detail}/>}<p className="fine-print">文字校正：{detail.original.textStatus==='proofread'?'原本との初回照合済み（再校正待ち）':'独立した二重校正は未完了（疑義があれば取得元で確認）'}</p></>:<><p className="fine-print">旧練習問題の履歴。本番の出題対象外です。</p><p className="reasoning">{detail.reasoning}</p>{detail.options.map(o=><div className="option-explanation" key={o.id}><b className={detail.answerIds.includes(o.id)?'mint':'coral'}>{o.id} · {detail.answerIds.includes(o.id)?'正しい':'誤り'}</b><p>{detailText(o.text)}</p><small>{o.explanation}</small></div>)}</>}
      {detail.original&&<><h3>知識マップの論点</h3><div className="related-list">{detail.conceptIds.map(id=><button key={id} onClick={()=>{setReturnDetail(detail);setDetail(undefined);setConceptId(id);}}>{concepts.find(c=>c.id===id)?.label??id}<span>→</span></button>)}</div>
      </>}<h3>原典</h3>{detail.provenance.sources.map(s=>{const source=sources.find(x=>x.id===s.sourceId);return source&&<p className="source-link" key={`${s.sourceId}:${s.locator}`}><a target="_blank" rel="noopener noreferrer" href={source.url}>{source.title} ↗</a><small>{s.locator}</small></p>;})}<p className="fine-print">{officialNotice}</p><a href="https://www.sssc.or.jp/pastissues/index.html" target="_blank" rel="noopener noreferrer">過去問題の利用条件 ↗</a><button className="primary" onClick={()=>setDetail(undefined)}>元の画面へ戻る<span>↩</span></button></div></Modal>}
    {originalQuestion&&<Modal title="公式問題の原本" onClose={()=>setOriginalQuestion(undefined)}><div className="detail-content"><OriginalImage key={originalQuestion.id} question={originalQuestion} expanded/><p className="fine-print">{officialNotice}</p><button className="primary" onClick={()=>setOriginalQuestion(undefined)}>元の画面へ戻る<span>↩</span></button></div></Modal>}
    {activeConcept&&<Modal title={activeConcept.label} onClose={()=>{setConceptId(undefined);if(returnDetail){setDetail(returnDetail);setReturnDetail(undefined);}}}><div className="detail-content"><span className={`status-pill ${conceptStatus(mapProgress[activeConcept.id])}`}>{statusLabel[conceptStatus(mapProgress[activeConcept.id])]}</span><p className="reasoning">{activeConcept.summary}</p><p>学習した選択肢：{mapProgress[activeConcept.id]?.seenQuestionIds.length??0}枚<br/>学習レベル：{formatKnowledgeLevel(mapProgress[activeConcept.id]?.level??0)}<br/>要復習カード比率：{Math.round((mapProgress[activeConcept.id]?.review??0)*100)}%</p><h3>関連する知識</h3><div className="related-list">{activeConcept.relatedIds.map(id=><button key={id} onClick={()=>setConceptId(id)}>{concepts.find(c=>c.id===id)?.label}<span>→</span></button>)}</div></div></Modal>}
    {importPreview&&<Modal title="履歴の読み込み" onClose={()=>setImportPreview(undefined)}><div className="detail-content"><p>このファイルには <b>{importPreview.attempts.length}件</b>の解答、<b>{totalXp(importPreview)} XP</b>、外部記録 <b>{importPreview.externalRecords.length}件</b>が含まれます。</p><p>現在の履歴をこのファイルの内容で置き換えます。必要なら先に書き出してください。</p><button className="secondary" onClick={()=>download(JSON.stringify(player,null,2),'care-manager-quest-before-import.json')}>現在の履歴を書き出す</button><button className="primary" onClick={()=>{setPlayer(importPreview);setBlocked(false);setImportPreview(undefined);setNotice('履歴を読み込みました。');go(importPreview.session?'play':'home');}}>読み込んで置き換える<span>→</span></button></div></Modal>}
  </div>;
}
function ExternalForm({onSave,disabled}:{onSave:(url:string,label:string,correct:boolean)=>void;disabled:boolean}) {
 const [url,setUrl]=useState(''),[label,setLabel]=useState(''),[correct,setCorrect]=useState(true),[error,setError]=useState('');
 return <section className="panel"><h2>外で解いた過去問を記録</h2><a className="external-entry" href="https://keamane.kakomonn.com/list2/80001?page=1" target="_blank" rel="noopener noreferrer">介護支援分野を開く ↗</a><form onSubmit={e=>{e.preventDefault();if(!validExternalUrl(url.trim())){setError('https://keamane.kakomonn.com/questions/数字 の個別問題URLを入力してください。');return;}onSave(url.trim(),label.trim()||'外部の過去問',correct);setUrl('');setLabel('');setError('');}}><label>問題の固定URL<input type="url" required placeholder="https://keamane.kakomonn.com/questions/…" value={url} maxLength={500} onChange={e=>setUrl(e.target.value)}/></label><label>表示名（任意）<input value={label} maxLength={100} placeholder="例：第28回 問1" onChange={e=>setLabel(e.target.value)}/></label><fieldset><legend>解いた結果</legend><label><input type="radio" name="external-result" checked={correct} onChange={()=>setCorrect(true)}/>正解</label><label><input type="radio" name="external-result" checked={!correct} onChange={()=>setCorrect(false)}/>不正解</label></fieldset>{error&&<p className="coral" role="alert">{error}</p>}<button className="secondary" type="submit" disabled={disabled}>結果を記録する</button></form></section>;
}

