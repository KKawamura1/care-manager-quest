import { useEffect, useRef, useState } from 'react';
import type { Question } from '../domain/models';
import { questionCopyText } from '../domain/questionCopy';

export function CopyQuestion({ question, includeAnswer = false, selectedIds }: { question: Question; includeAnswer?: boolean; selectedIds?: readonly string[] }) {
  const text = questionCopyText(question, includeAnswer, selectedIds);
  return <CopyText text={text}/>;
}

export function CopyText({ text }: { text: string; includeAnswer?: boolean }) {
  const [status, setStatus] = useState<'idle' | 'copying' | 'copied' | 'manual'>('idle');
  const textRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => setStatus('idle'), [text]);
  const selectText = () => {
    const area = textRef.current;
    if (!area) return;
    area.focus(); area.select(); area.setSelectionRange(0, area.value.length);
  };
  async function copy() {
    setStatus('copying');
    try {
      await navigator.clipboard.writeText(text);
      setStatus('copied');
    } catch {
      setStatus('manual');
    }
  }
  return <div className="copy-question">
    <button type="button" className="secondary copy-question-button" disabled={status === 'copying'} onClick={() => void copy()}>
      <svg className="copy-question-icon" aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="8" y="8" width="12" height="13" rx="2"/>
        <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h3"/>
      </svg>
      問題をコピー
    </button>
    {(status === 'copied' || status === 'manual') && <p className="fine-print" role="status">{status === 'copied' ? 'コピーしました' : '下の文章を選択してコピーしてください'}</p>}
    {status === 'manual' && <div className="manual-copy">
      <label>ChatGPTに貼り付ける文章<textarea ref={textRef} readOnly value={text} onFocus={selectText} /></label>
      <button type="button" className="text-button" onClick={selectText}>全文を選択</button>
    </div>}
  </div>;
}
