import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { glossaryTerms } from '../data/glossary';
import { splitGlossaryText, type GlossaryTerm } from '../domain/glossary';
import { Modal } from './Modal';

export function GlossaryText({ text, requireConfirmation = false, onHintUsed }: { text: string; requireConfirmation?: boolean; onHintUsed?: () => void }) {
  const parts = useMemo(() => splitGlossaryText(text, glossaryTerms), [text]);
  const [selected, setSelected] = useState<{ term: GlossaryTerm; confirmed: boolean }>();
  return <>
    {parts.map((part, index) => part.term ? <button key={index} type="button" className="glossary-term" aria-label={`${part.text}の用語解説`} aria-haspopup="dialog"
      onPointerDown={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}
      onClick={e => { e.stopPropagation(); if (!requireConfirmation) onHintUsed?.(); setSelected({term: part.term!, confirmed: !requireConfirmation}); }}>{part.text}</button> : part.text)}
    {selected && createPortal(<div onPointerDown={e => e.stopPropagation()} onPointerUp={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
      <Modal key={selected.confirmed ? 'definition' : 'confirmation'} title={selected.confirmed ? selected.term.label : '用語解説を見ますか？'} onClose={() => setSelected(undefined)}>
        {selected.confirmed ? <div className="glossary-definition"><p>{selected.term.description}</p><a href={selected.term.sourceUrl} target="_blank" rel="noopener noreferrer">出典を確認 ↗</a><p className="fine-print">用語の一般的な意味です。設問の正誤や試験当時の制度とは分けて確認してください。</p></div> :
          <div className="glossary-definition"><p>「{selected.term.label}」の解説を見ると、このカードの学習記録は、その後の解答にかかわらず不正解扱いになります。</p>
            <button className="primary" onClick={() => { onHintUsed?.(); setSelected({...selected, confirmed: true}); }}>解説を見る（不正解扱い）</button>
            <button className="secondary" onClick={() => setSelected(undefined)}>見ずに戻る</button>
          </div>}
      </Modal>
    </div>, document.body)}
  </>;
}
