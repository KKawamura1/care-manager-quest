import { useEffect, useId, useRef, type ReactNode } from 'react';
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current!;
    const previous = document.activeElement as HTMLElement | null;
    dialog.showModal();
    return () => { dialog.close(); previous?.focus(); };
  }, []);
  return <dialog ref={ref} onCancel={e => { e.stopPropagation(); onClose(); }} aria-labelledby={titleId} onClick={e => { if (e.target === ref.current) onClose(); }}>
    <div className="sheet"><header className="sheet-head"><h2 id={titleId}>{title}</h2><button className="icon-button" aria-label="閉じる" onClick={onClose}>×</button></header>{children}</div>
  </dialog>;
}
