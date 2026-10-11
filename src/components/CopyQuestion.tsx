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
    <button type="button" className="secondary" disabled={status === 'copying'} onClick={() => void copy()}>問題をコピー</button>
    {(status === 'copied' || status === 'manual') && <p className="fine-print" role="status">{status === 'copied' ? 'コピーしました' : '下の文章を選択してコピーしてください'}</p>}
    {status === 'manual' && <div className="manual-copy">
      <label>ChatGPTに貼り付ける文章<textarea ref={textRef} readOnly value={text} onFocus={selectText} /></label>
      <button type="button" className="text-button" onClick={selectText}>全文を選択</button>
    </div>}
  </div>;
}
