import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { glossaryTerms } from '../data/glossary';
import { splitGlossaryText, type GlossaryTerm } from '../domain/glossary';
import { Modal } from './Modal';

export function GlossaryText({ text }: { text: string }) {
  const parts = useMemo(() => splitGlossaryText(text, glossaryTerms), [text]);
  const [selected, setSelected] = useState<GlossaryTerm>();
  return <>
    {parts.map((part, index) => part.term ? <button key={index} type="button" className="glossary-term" aria-label={`${part.text}の用語解説`} aria-haspopup="dialog"
      onPointerDown={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}
      onClick={e => { e.stopPropagation(); setSelected(part.term); }}>{part.text}</button> : part.text)}
    {selected && createPortal(<div onPointerDown={e => e.stopPropagation()} onPointerUp={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
      <Modal title={selected.label} onClose={() => setSelected(undefined)}>
        <div className="glossary-definition"><p>{selected.description}</p><a href={selected.sourceUrl} target="_blank" rel="noopener noreferrer">出典を確認 ↗</a><p className="fine-print">用語の一般的な意味です。設問の正誤や試験当時の制度とは分けて確認してください。</p></div>
      </Modal>
    </div>, document.body)}
  </>;
}
