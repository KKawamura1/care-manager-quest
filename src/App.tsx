import { useEffect, useRef, useState } from 'react';
import { categories, concepts } from './data/knowledge';
import { questions, questionById } from './data/provider';
import { sources, officialNotice } from './data/sources';
import { advance, buildSession, conceptStatus, emptyPlayer, levelInfo, reflect, submitAnswer, totalXp } from './domain/game';
import { loadPlayer, MAX_IMPORT_BYTES, parsePlayer, savePlayer, STORAGE_KEY, validExternalUrl } from './domain/storage';
import { playSound } from './domain/sound';
import type { PlayerState, Question } from './domain/models';
import { Modal } from './components/Modal';
import { Emblem } from './components/Emblem';
import { OriginalImage } from './components/OriginalImage';
import { CopyQuestion } from './components/CopyQuestion';
const DOMAIN_OPTIONS = [
  {value:'介護支援分野',label:'介護支援（25問）'},
  {value:'保健医療サービスの知識等',label:'保健医療（20問）'},
  {value:'福祉サービスの知識等',label:'福祉（15問）'},
  {value:'all',label:'全分野（60問）'},
] as const;
type DomainFilter = typeof DOMAIN_OPTIONS[number]['value'];
const DOMAIN_STORAGE_KEY = 'care-manager-quest:domain-filter';
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
  const [domainFilter,setDomainFilter] = useState<DomainFilter>(()=>{
    try {const stored=window.localStorage.getItem(DOMAIN_STORAGE_KEY); return DOMAIN_OPTIONS.some(option=>option.value===stored)?stored as DomainFilter:'介護支援分野';}
    catch {return '介護支援分野';}
  });
  const activeQuestions = questions.filter(question=>domainFilter==='all'||question.domain===domainFilter);
  const changeDomain = (next: DomainFilter) => {setDomainFilter(next);try{window.localStorage.setItem(DOMAIN_STORAGE_KEY,next);}catch{/* continue without persistence */}};
  const [initial] = useState(initiallyLoad);
  const [player, setPlayer] = useState<PlayerState>(initial.player);
  const [blocked, setBlocked] = useState(Boolean('raw' in initial && initial.raw && initial.error));
  const [saveError, setSaveError] = useState(initial.error);
  const [route, setRoute] = useState<'home'|'play'|'map'|'records'>(initial.player.session ? 'play' : 'home');
  const [detail, setDetail] = useState<Question>();
  const [conceptId, setConceptId] = useState<string>();
  const [importPreview, setImportPreview] = useState<PlayerState>();
  const [notice, setNotice] = useState(initial.migrated?'以前の履歴・XPを引き継ぎました。旧問題の途中クエストを終了し、2025年度の公式過去問に切り替えました。':'');
  const [originalQuestion,setOriginalQuestion]=useState<Question>();
  const [returnDetail,setReturnDetail]=useState<Question>();
  const [burst, setBurst] = useState<'correct'|'wrong'|'level'>();
  const fileRef = useRef<HTMLInputElement>(null);
  const xp = totalXp(player), level = levelInfo(xp), session = player.session;
  const current = session ? questionById(session.questionIds[session.index]) : undefined;
  const attempt = session ? player.attempts.find(a => a.id === `${session.id}:${session.index}`) : undefined;
  const inSession = session ? player.attempts.filter(a => a.sessionId === session.id) : [];
  const selected = session?.selectedIds ?? [];
  const explored = concepts.filter(c => conceptStatus(player.concepts[c.id]) !== 'unexplored').length;
  const mastered = concepts.filter(c => conceptStatus(player.concepts[c.id]) === 'mastered').length;
  const activeConcept = concepts.find(c=>c.id===conceptId);
  useEffect(() => {
    if (blocked) return;
    try { setSaveError(savePlayer(window.localStorage, player)); }
    catch { setSaveError('履歴を保存できません。JSONを書き出してください。'); }
  }, [player, blocked]);
  useEffect(()=>{ if (!burst) return; const timer = setTimeout(()=>setBurst(undefined),900); return ()=>clearTimeout(timer); },[burst]);
  const go = (next: typeof route) => { setRoute(next); window.scrollTo({top:0,behavior:'instant'}); };
  const start = () => {
    if (blocked) return;
    setPlayer(p=>({ ...p, session: buildSession(activeQuestions,p.attempts,crypto.randomUUID()) })); go('play'); setNotice('');
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
    const result = next.attempts.at(-1)!;
    const kind = levelInfo(totalXp(next)).level > level.level ? 'level' : result.correct ? 'correct' : 'wrong';
    setPlayer(next); setBurst(kind); playSound(kind,player.settings.sound);
    requestAnimationFrame(()=>document.getElementById('feedback')?.scrollIntoView({block:'start',behavior:'instant'}));
  };
  const nextQuestion = () => { setPlayer(advance); window.scrollTo({top:0,behavior:'instant'}); };
  async function readImport(file?: File) {
    if (!file) return;
    try {
      if (file.size > MAX_IMPORT_BYTES) throw new Error('履歴ファイルは2MB以内にしてください。');
      setImportPreview(parsePlayer(await file.text())); setNotice('');
    } catch (e) { setNotice(e instanceof Error ? e.message : '読み込みに失敗しました。'); }
    if (fileRef.current) fileRef.current.value = '';
  }
  const headline = <><span className="brand-mark">◇</span><div><strong>CARE MANAGER</strong><span>QUEST</span></div></>;
  return <div className="app-shell">
    <header className="app-header"><button className="brand" aria-label="冒険ホームへ" onClick={()=>go('home')}>{headline}</button><button className="sound-button" aria-label={`効果音を${player.settings.sound?'オフ':'オン'}にする`} aria-pressed={player.settings.sound} onClick={()=>setPlayer(p=>({...p,settings:{sound:!p.settings.sound}}))}>{player.settings.sound?'♪':'♪̸'}<span>{player.settings.sound?'ON':'OFF'}</span></button></header>
    <div className="player-bar"><span className="level-chip">LV <b>{level.level.toString().padStart(2,'0')}</b></span><div className="xp-track"><div className="xp-caption"><span>{level.level===1?'知識の冒険者':level.level===2?'制度の探索者':level.level<5?'認定の探究者':'ケアの探究者'}</span><span>{level.current} / 200 XP</span></div><div className="meter"><i style={{width:`${level.current/2}%`}}/></div></div></div>
    {saveError && <div className="warning" role="alert"><p>{saveError}</p>{blocked && <><button onClick={()=>download(('raw' in initial && initial.raw) || '', 'care-manager-quest-recovery.json')}>元のデータを書き出す</button><button onClick={()=>{setBlocked(false);setPlayer(emptyPlayer());setSaveError(undefined);}}>新しい履歴で始める</button></>}</div>}
    {notice && <p className="notice" role="status">{notice}</p>}
    <main>
      {route === 'home' && <>
        <section className="hero"><div className="eyebrow"><span className="live-dot"/> THE KNOWLEDGE ADVENTURE</div><div className="hero-art"><Emblem/></div><h1>推理が、<br/><span>知識に変わる。</span></h1><p>推理して、介護保険の世界をつなげる。</p><div className="hero-meta"><span>2025年度 公式過去問60問</span><span>現在の出題：{activeQuestions.length}問</span></div></section>
        <section className="mission-card"><div className="section-kicker">YOUR NEXT QUEST <span>5 QUESTIONS</span></div><h2>介護保険の世界へ</h2><p>2025年度・全60問の公式過去問。出題分野を選んで5問ずつ挑戦できます。</p><fieldset className="domain-picker"><legend>出題する分野</legend>{DOMAIN_OPTIONS.map(option=><label key={option.value}><input type="radio" name="quest-domain" checked={domainFilter===option.value} onChange={()=>changeDomain(option.value)}/><span>{option.label}</span></label>)}</fieldset>{session&&!session.completed&&<p className="mission-note">分野変更は次の新しいクエストから反映します。進行中の5問はそのまま再開できます。</p>}<div className="quest-path">{['入口','探索','難問','ひと息','応用'].map((x,i)=><div key={x} className={i===2?'boss':''}><span>{i===2?'✦':i+1}</span><small>{x}</small></div>)}</div><button className="primary" disabled={blocked} onClick={session&&!session.completed?()=>go('play'):start}>{session&&!session.completed?`第${session.index+1}問から再開`:'5問のクエストを始める'}<span>→</span></button><div className="mission-note">1回5問 · 複数選択 · 途中でも自動保存</div></section>
        <section className="discovery"><div><span className="section-kicker">YOUR DISCOVERIES</span><h2>知識の地図を広げよう</h2><p>{explored} / {concepts.length} 概念を探索 · {mastered} 習得済み</p></div><button aria-label="知識マップを見る" onClick={()=>go('map')}>↗</button></section>
        <div className="home-tip"><span>✦</span><p>初見正解で <b>+20 XP</b>。<br/>原本と正答を確かめて、知識マップへ。</p></div>
      </>}
      {route === 'play' && current && session && !session.completed && <section className="play-screen">
        <div className="quest-heading"><button className="text-button" onClick={()=>go('home')}>‹ 中断してホーム</button><span>QUEST / {session.index+1} OF 5</span></div>
        <div className="question-progress">{session.questionIds.map((id,i)=>{const a=inSession[i];return <span key={id} className={i===session.index?'current':a?a.correct?'won':'lost':''}>{a?(a.correct?'✓':'·'):i+1}</span>;})}</div>
        <div className="question-meta"><span className={`difficulty d${current.difficulty}`}>{['','ENTRY','TACTICAL','CHALLENGE'][current.difficulty]} {'◆'.repeat(current.difficulty)}</span><span>{categories.find(c=>c.id===current.primaryCategory)?.label}</span></div>
        <h1 className="question-title">{current.title}</h1><p className="question-stem">{current.stem}</p>{current.original?.textStatus==='pending'&&<p className="proofreading-note">原本との独立した二重校正は未実施です。疑義があれば原本を確認してください。</p>}
        {current.original&&<div className="question-tools"><button className="text-button" onClick={()=>setOriginalQuestion(current)}>原本画像を見る ↗</button><span>2025年度当時の正答で採点</span></div>}
        {!attempt&&<CopyQuestion key={current.id} question={current}/>}
        <div className="question-concepts" aria-label="この問題の知識マップ">{current.conceptIds.map(id=><button key={id} onClick={()=>setConceptId(id)}>⌘ {concepts.find(c=>c.id===id)?.label??id}</button>)}</div>
        <div className="selection-instruction"><b>{current.selectionCount}つ選択</b><span>{attempt?'解答済み':`${selected.length} / ${current.selectionCount} 選択中`}</span></div>
        <div className="options" role="group" aria-label="解答の選択肢">{current.options.map((o,i)=>{
          const chosen=selected.includes(o.id), correct=attempt&&current.answerIds.includes(o.id), wrong=attempt&&chosen&&!correct;
          return <button key={o.id} className={`option ${chosen?'selected':''} ${correct?'correct':''} ${wrong?'wrong':''}`} aria-pressed={chosen} disabled={Boolean(attempt)} onClick={()=>choose(o.id)}><span className="option-number">{attempt?(correct?'✓':wrong?'×':i+1):i+1}</span><span>{o.text}{attempt&&<small>{correct?'正答':wrong?'選択した誤答':chosen?'あなたの選択':'不正解の選択肢'}</small>}</span><span className="check-box" aria-hidden="true">{chosen?'✓':''}</span></button>;
        })}</div>
        {attempt && <section id="feedback" className={`feedback ${attempt.correct?'success':'miss'}`} role="status"><div className="feedback-top"><div><span className="section-kicker">{attempt.correct?'QUEST CLEARED':'NEW DISCOVERY'}</span><h2>{attempt.correct?'正解！':'知識をひとつ、持ち帰ろう。'}</h2></div><b className="xp-award">+{attempt.xp}<small>XP</small></b></div><div className="reward-tags">{attempt.correct&&attempt.firstSeen&&<span>✦ 初見突破 +20</span>}{attempt.combo>1&&<span>🔥 {attempt.combo} COMBO</span>}{burst==='level'&&<span>LEVEL UP → {level.level}</span>}</div><p>{current.explanation || '2025年度試験当時の正答です。独自解説はまだ登録されていません。'}</p><p className="answer-key">正答：{current.answerIds.join('・')} ／ あなたの選択：{attempt.selectedIds.join('・')}</p></section>}
        {attempt&&<CopyQuestion key={current.id} question={current} includeAnswer selectedIds={attempt.selectedIds}/>}
        <div className="answer-dock">{attempt?<><button className="primary" onClick={nextQuestion}>{session.index===4?'リザルトを見る':'次の問題へ'}<span>→</span></button><button className="secondary" onClick={()=>setDetail(current)}>詳しく見る</button></>:<button className="primary" disabled={selected.length!==current.selectionCount||blocked} onClick={answer}>{selected.length===current.selectionCount?'答えを確定する':`あと${current.selectionCount-selected.length}つ選んでください`}<span>→</span></button>}</div>
      </section>}
      {route === 'play' && session?.completed && <section className="result-screen"><div className="eyebrow">QUEST COMPLETE</div><Emblem/><h1>{inSession.filter(a=>a.correct).length===5?'完全攻略！':'探索、おつかれさま。'}</h1><p>5つの問いから、知識の世界が広がった。</p><div className="result-score"><strong>{inSession.filter(a=>a.correct).length}<small>/ 5</small></strong><span>正解</span></div><div className="result-stats"><div><b>+{inSession.reduce((n,a)=>n+a.xp,0)}</b><span>獲得XP</span></div><div><b>{Math.max(...inSession.map(a=>a.combo),0)}</b><span>最大コンボ</span></div><div><b>{inSession.filter(a=>a.correct&&a.firstSeen).length}</b><span>初見突破</span></div></div><div className="result-list">{inSession.map(a=><button key={a.id} onClick={()=>setDetail(questionById(a.questionId))}><span className={a.correct?'mint':'coral'}>{a.correct?'✓':'↗'}</span><span>{questionById(a.questionId)?.title}</span><small>+{a.xp} XP</small></button>)}</div><div className="next-unlock"><span>✦ NEXT MILESTONE</span><h3>Lv.{level.level+1} まで、あと {level.next} XP</h3><p>{level.level<3?'Lv.3で「認定の探究者」の称号を解放。':'次のレベルで、探索の足跡をさらに積もう。'}<br/>分野設定から、保健医療・福祉サービス分野にも挑戦できます</p>{level.level>=3&&<b>称号解放：認定の探究者</b>}</div><button className="primary" onClick={start} disabled={blocked}>もう5問、探索する<span>→</span></button><button className="secondary" onClick={()=>go('map')}>広がった知識マップを見る</button></section>}
      {route === 'map' && <section className="map-screen"><div className="eyebrow">ATLAS OF KNOWLEDGE</div><h1>知識マップ</h1><p className="page-intro">点だった知識を、つながる理解へ。</p><div className="map-summary"><b>{explored}<small> / {concepts.length}</small></b><span>探索した概念</span><b>{mastered}<small> 習得</small></b></div><div className="map-legend"><span>○ 未探索</span><span className="gold">◐ 学習中</span><span className="mint">● 習得済み</span></div>
        {categories.filter(c=>!c.parentId).map(root=><section key={root.id} className={`map-region ${root.available?'':'future'}`}><div className="region-heading"><span>{root.id}</span><div><h2>{root.label}</h2><p>{root.description}</p></div>{!root.available&&<small>追加予定</small>}</div>{categories.filter(c=>c.parentId===root.id).map(cat=>{const nodes=concepts.filter(c=>c.categoryId===cat.id);return <details key={cat.id} open={cat.available}><summary><span>{cat.label}</span><small>{nodes.filter(c=>conceptStatus(player.concepts[c.id])==='mastered').length} / {nodes.length||'—'}</small></summary><div className="concept-grid">{nodes.map(c=>{const status=conceptStatus(player.concepts[c.id]);return <button className={`concept-node ${status}`} key={c.id} onClick={()=>setConceptId(c.id)}><span>{status==='mastered'?'●':status==='learning'?'◐':'○'}</span><span>{c.label}<small>{statusLabel[status]}</small></span><span>›</span></button>;})}{!nodes.length&&<p className="future-note">この領域の問題は今後追加します。</p>}</div></details>;})}</section>)}
        <p className="map-rule">習得済み＝関連する異なる2問以上に正解し、「理解を記録」した概念。MVPの目安です。試験範囲の完全網羅や、習熟度の推定は今後拡張します。</p>
      </section>}
      {route === 'records' && <section className="records-screen"><div className="eyebrow">ADVENTURE LOG</div><h1>冒険の記録</h1><p className="page-intro">このブラウザに、あなたの足跡を残す。</p><div className="record-stats"><div><b>{player.attempts.length}</b><span>解いた問題</span></div><div><b>{xp}</b><span>合計XP</span></div><div><b>{player.attempts.filter(a=>a.correct).length}</b><span>正解</span></div></div><section className="panel"><h2>履歴を持ち出す</h2><p>JSONに書き出すと、別のブラウザでも続きから遊べます。読み込み前に内容を確認できます。</p><button className="primary" onClick={()=>download(JSON.stringify(player,null,2),'care-manager-quest-history.json')}>JSONを書き出す <span>↓</span></button><button className="secondary" onClick={()=>fileRef.current?.click()}>JSONを読み込む</button><input type="file" accept=".json,application/json" ref={fileRef} hidden onChange={e=>void readImport(e.target.files?.[0])}/></section>
        <ExternalForm onSave={(url,label,correct)=>{setPlayer(p=>({...p,externalRecords:[...p.externalRecords,{id:crypto.randomUUID(),url,label,correct,at:new Date().toISOString()}]}));setNotice('外部サイトの結果を記録しました。');}} disabled={blocked}/>
        {player.externalRecords.length>0&&<section className="panel"><h2>外部サイトの記録</h2><div className="log-list">{player.externalRecords.slice(-10).reverse().map(e=><div key={e.id}><span className={e.correct?'mint':'coral'}>{e.correct?'✓':'×'}</span><a href={e.url} target="_blank" rel="noopener noreferrer">{e.label} ↗</a><small>{new Date(e.at).toLocaleDateString('ja-JP')}</small></div>)}</div></section>}
        <section className="panel"><h2>最近の探索</h2>{player.attempts.length===0?<p>まだ冒険の記録はありません。最初の5問へ。</p>:<div className="log-list">{player.attempts.slice(-10).reverse().map(a=><button key={a.id} onClick={()=>setDetail(questionById(a.questionId))}><span className={a.correct?'mint':'coral'}>{a.correct?'✓':'×'}</span><span>{questionById(a.questionId)?.title}</span><small>+{a.xp} XP</small></button>)}</div>}</section><p className="map-rule">2025年度 公式過去問 · 2025年度試験当時の正答で採点 · 現行法への適合性は未確認<br/>独自分類は試験センターと関係がありません。</p>
      </section>}
      <p className="copyright-note">{officialNotice}<br/>2025年度試験当時の正答で採点。現行法への適合性は未確認です。</p>
    </main>
    <nav className="bottom-nav" aria-label="メインメニュー">{([['home','◇','冒険'],['map','⌘','知識マップ'],['records','≡','記録']] as const).map(([key,icon,label])=><button key={key} aria-label={label} className={(route===key||(key==='home'&&route==='play'))?'active':''} aria-current={(route===key||(key==='home'&&route==='play'))?'page':undefined} onClick={()=>go(key)}><span>{icon}</span>{label}</button>)}</nav>
    {burst && <div className={`burst ${burst}`} aria-hidden="true">{Array.from({length:18},(_,i)=><i key={i} style={{'--angle':`${i*20}deg`,'--distance':`${70+(i%4)*27}px`,'--delay':`${(i%3)*25}ms`} as React.CSSProperties}/>)}<span>{burst==='level'?'LEVEL UP':burst==='correct'?'CLEAR!':'DISCOVER'}</span></div>}
    {detail&&<Modal title="詳しく見る" onClose={()=>setDetail(undefined)}><div className="detail-content"><div className="eyebrow">THE CONNECTION</div><h3>{detail.title}</h3>
      <CopyQuestion key={detail.id} question={detail} includeAnswer selectedIds={player.attempts.slice().reverse().find(a=>a.questionId===detail.id)?.selectedIds}/>
      {detail.original?<><p>2025年度試験当時の正答：<b className="mint">{detail.answerIds.join('・')}</b></p><p className="proofreading-note">現行法への適合性は未確認です。独自解説は未登録です。</p><OriginalImage key={detail.id} question={detail}/><p className="fine-print">文字校正：{detail.original.textStatus==='proofread'?'原本との初回照合済み（再校正待ち）':'独立した二重校正は未完了（疑義があれば原本優先）'}</p></>:<><p className="fine-print">旧練習問題の履歴。本番の出題対象外です。</p><p className="reasoning">{detail.reasoning}</p>{detail.options.map(o=><div className="option-explanation" key={o.id}><b className={detail.answerIds.includes(o.id)?'mint':'coral'}>{o.id} · {detail.answerIds.includes(o.id)?'正しい':'誤り'}</b><p>{o.text}</p><small>{o.explanation}</small></div>)}</>}
      <h3>知識マップの論点</h3><p className="fine-print">分類は暫定です。試験センターの公式分類ではありません。</p><div className="related-list">{detail.conceptIds.map(id=><button key={id} onClick={()=>{setReturnDetail(detail);setDetail(undefined);setConceptId(id);}}>{concepts.find(c=>c.id===id)?.label??id}<span>→</span></button>)}</div>
      <button className="secondary" onClick={()=>{setPlayer(p=>reflect(p,detail.conceptIds));setNotice('この問題に関連する理解を記録しました。');}}>理解を記録する</button><p className="fine-print">解いた問題に関連する概念に記録します。XPは加算しません。</p><h3>原典</h3>{detail.provenance.sources.map(s=>{const source=sources.find(x=>x.id===s.sourceId);return source&&<p className="source-link" key={s.sourceId}><a target="_blank" rel="noopener noreferrer" href={source.url}>{source.title} ↗</a><small>{s.locator}</small></p>;})}<p className="fine-print">{officialNotice}</p><a href="https://www.sssc.or.jp/pastissues/index.html" target="_blank" rel="noopener noreferrer">過去問題の利用条件 ↗</a><button className="primary" onClick={()=>setDetail(undefined)}>元の画面へ戻る<span>↩</span></button></div></Modal>}
    {originalQuestion&&<Modal title="公式問題の原本" onClose={()=>setOriginalQuestion(undefined)}><div className="detail-content"><OriginalImage key={originalQuestion.id} question={originalQuestion} expanded/><p className="fine-print">{officialNotice}</p><button className="primary" onClick={()=>setOriginalQuestion(undefined)}>元の画面へ戻る<span>↩</span></button></div></Modal>}
    {activeConcept&&<Modal title={activeConcept.label} onClose={()=>{setConceptId(undefined);if(returnDetail){setDetail(returnDetail);setReturnDetail(undefined);}}}><div className="detail-content"><span className={`status-pill ${conceptStatus(player.concepts[activeConcept.id])}`}>{statusLabel[conceptStatus(player.concepts[activeConcept.id])]}</span><p className="reasoning">{activeConcept.summary}</p><p>探索した問題：{player.concepts[activeConcept.id]?.seenQuestionIds.length??0}問<br/>正解した異なる問題：{player.concepts[activeConcept.id]?.correctQuestionIds.length??0}問<br/>理解の記録：{player.concepts[activeConcept.id]?.reflected?'あり':'まだ'}</p><h3>つながる概念</h3><div className="related-list">{activeConcept.relatedIds.map(id=><button key={id} onClick={()=>setConceptId(id)}>{concepts.find(c=>c.id===id)?.label}<span>→</span></button>)}</div><button className="secondary" disabled={!player.concepts[activeConcept.id]?.seenQuestionIds.length} onClick={()=>setPlayer(p=>reflect(p,[activeConcept.id]))}>理解を記録する</button><p className="fine-print">まず関連問題を解くと、理解を記録できます。</p></div></Modal>}
    {importPreview&&<Modal title="履歴の読み込み" onClose={()=>setImportPreview(undefined)}><div className="detail-content"><p>このファイルには <b>{importPreview.attempts.length}件</b>の解答、<b>{totalXp(importPreview)} XP</b>、外部記録 <b>{importPreview.externalRecords.length}件</b>が含まれます。</p><p>現在の履歴をこのファイルの内容で置き換えます。必要なら先に書き出してください。</p><button className="secondary" onClick={()=>download(JSON.stringify(player,null,2),'care-manager-quest-before-import.json')}>現在の履歴を書き出す</button><button className="primary" onClick={()=>{setPlayer(importPreview);setBlocked(false);setImportPreview(undefined);setNotice('履歴を読み込みました。');go(importPreview.session?'play':'home');}}>読み込んで置き換える<span>→</span></button></div></Modal>}
  </div>;
}
function ExternalForm({onSave,disabled}:{onSave:(url:string,label:string,correct:boolean)=>void;disabled:boolean}) {
 const [url,setUrl]=useState(''),[label,setLabel]=useState(''),[correct,setCorrect]=useState(true),[error,setError]=useState('');
 return <section className="panel"><h2>外で解いた過去問を記録</h2><p>過去問ドットコムの個別問題URLと結果を保存。問題文・解説は取り込みません。XPと概念習得には反映しません。</p><a className="external-entry" href="https://keamane.kakomonn.com/list2/80001?page=1" target="_blank" rel="noopener noreferrer">介護支援分野を開く ↗</a><form onSubmit={e=>{e.preventDefault();if(!validExternalUrl(url.trim())){setError('https://keamane.kakomonn.com/questions/数字 の個別問題URLを入力してください。');return;}onSave(url.trim(),label.trim()||'外部の過去問',correct);setUrl('');setLabel('');setError('');}}><label>問題の固定URL<input type="url" required placeholder="https://keamane.kakomonn.com/questions/…" value={url} maxLength={500} onChange={e=>setUrl(e.target.value)}/></label><label>表示名（任意）<input value={label} maxLength={100} placeholder="例：第28回 問1" onChange={e=>setLabel(e.target.value)}/></label><fieldset><legend>解いた結果</legend><label><input type="radio" name="external-result" checked={correct} onChange={()=>setCorrect(true)}/>正解</label><label><input type="radio" name="external-result" checked={!correct} onChange={()=>setCorrect(false)}/>不正解</label></fieldset>{error&&<p className="coral" role="alert">{error}</p>}<button className="secondary" type="submit" disabled={disabled}>結果を記録する</button></form></section>;
}
