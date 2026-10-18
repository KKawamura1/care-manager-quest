import { useEffect, useId, useState } from 'react';
import { explanationStorageKey, parseAppExplanation, type AppExplanation as SavedExplanation, type ExplanationTarget } from '../domain/appExplanation';
import { RegisteredExplanation } from './RegisteredExplanation';

// Mount with a target-specific key so drafts never carry over to another card.
export function AppExplanation({ target }: { target: ExplanationTarget }) {
  const inputId = useId();
  const [initial] = useState(() => {
    try {
      const raw = localStorage.getItem(explanationStorageKey(target));
      return { saved: raw ? parseAppExplanation(raw, target) : undefined, error: '' };
    } catch (e) { return { saved: undefined, error: e instanceof Error ? e.message : '保存した解説を読み取れません。' }; }
  });
  const [saved, setSaved] = useState<SavedExplanation | undefined>(initial.saved);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState(initial.error);
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    const refresh = () => {
      try {
        const raw = localStorage.getItem(explanationStorageKey(target));
        setSaved(raw ? parseAppExplanation(raw, target) : undefined); setError('');
      } catch (e) { setSaved(undefined); setError(e instanceof Error ? e.message : '解説を読み取れません。'); }
    };
    window.addEventListener('app-explanation-change', refresh);
    window.addEventListener('storage', refresh);
    return () => { window.removeEventListener('app-explanation-change', refresh); window.removeEventListener('storage', refresh); };
  }, [target.questionId, target.questionVersion, target.choiceId, target.cardRevision, target.questionRevision]);
  function save() {
    setMessage('');
    try {
      const parsed = parseAppExplanation(draft, target);
      localStorage.setItem(explanationStorageKey(target), JSON.stringify(parsed));
      setSaved(parsed); setError(''); setDraft(''); setEditing(false); setMessage('短い解説を保存しました。');
      window.dispatchEvent(new Event('app-explanation-change'));
    } catch (e) { setError(e instanceof Error ? e.message : '解説を保存できません。このブラウザの保存領域を確認してください。'); }
  }
  function remove() {
    try {
      localStorage.removeItem(explanationStorageKey(target)); setSaved(undefined); setError(''); setMessage('保存した解説を削除しました。');
      window.dispatchEvent(new Event('app-explanation-change'));
    } catch { setError('解説を削除できません。'); }
  }
  return <section className="app-explanation" aria-label="アプリ用の短い解説">
    <RegisteredExplanation key={JSON.stringify(target)} target={target}/>
    {saved && <><h3>自分用の解説</h3><p className="saved-explanation">{saved.explanation}</p></>}
    <button type="button" className="secondary" onClick={() => { setEditing(!editing); setMessage(''); }}>{editing ? '貼り付けを閉じる' : saved ? '短い解説を貼り替える' : '短い解説を貼り付ける'}</button>
    {editing && <div className="manual-copy">
      <p className="fine-print">ChatGPTの解説ブロックを貼り付けてください。</p>
      <label htmlFor={inputId}>アプリ用の短い解説を貼り付け</label>
      <textarea id={inputId} value={draft} maxLength={16_000} onChange={e => setDraft(e.target.value)} />
      <button type="button" className="primary" disabled={!draft.trim()} onClick={save}>短い解説を保存</button>
    </div>}
    {saved && <button type="button" className="text-button" onClick={remove}>保存した解説を削除</button>}
    {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
  </section>;
}
