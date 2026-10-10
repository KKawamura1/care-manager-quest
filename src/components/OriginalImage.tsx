import { useState } from 'react';
import type { Question } from '../domain/models';
export function OriginalImage({question, expanded=false}:{question:Question;expanded?:boolean}) {
 const [zoom,setZoom]=useState(expanded),[failed,setFailed]=useState(false);
 if(!question.original)return null;
 const o=question.original;
 return <div className="original-reader">
   <div className="image-toolbar"><span>{o.year}年度 問{o.number} · 原本</span><button type="button" onClick={()=>setZoom(v=>!v)}>{zoom?'全体を表示':'拡大して読む'}</button></div>
   <p className="image-hint">{zoom?'画像を上下・左右に動かして読めます。':'拡大ボタン、または画像を別画面で開いて読めます。'}</p>
   <div className={`image-frame ${zoom?'zoomed':''}`} tabIndex={0} aria-label={`問${o.number}の原本画像。拡大時はスクロールできます。`}>
    {!failed?<img src={o.imagePath} alt={`2025年度 公式過去問 問${o.number}の原本。問題文と選択肢1〜5。`} onError={()=>setFailed(true)}/>:<p role="alert">原本画像を読み込めません。下のリンクから原本を開いてください。</p>}
   </div>
   <a href={o.imagePath} target="_blank" rel="noopener noreferrer">原本画像を別画面で開く ↗</a>
 </div>;
}
