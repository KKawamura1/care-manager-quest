import type { Question } from '../domain/models';
import { explanationFor } from '../data/bundled-explanations';

export function BundledExplanation({ question, choiceId, truth, expanded = false, fallback }: {
  question: Question | undefined; choiceId?: string; truth?: boolean; expanded?: boolean; fallback?: string;
}) {
  const entry = explanationFor(question);
  const choice = entry?.choices.find(c => c.id === choiceId);
  if (!entry || (choiceId !== undefined && (!choice || choice.truth !== truth))) {
    return <p>{fallback || 'この問題の解説は準備中です。'}</p>;
  }
  const choices = <div className="bundled-choices">{entry.choices.map(c => <div className="option-explanation" key={c.id}>
    <b className={c.truth ? 'mint' : 'coral'}>選択肢{c.id}：{c.truth ? '○' : '×'}</b>
    <p>{c.explanation}</p>
  </div>)}</div>;
  return <section className="bundled-explanation" aria-label="問題の解説">
    <h3>解説</h3><p>{choice ? choice.explanation : entry.overview}</p>
    {!choice && (expanded ? choices : <details><summary>選択肢別の解説を見る</summary>{choices}</details>)}
    <p className="fine-print">{entry.basis}。{entry.lawNote}</p>
    <details className="explanation-sources"><summary>解説の参考資料</summary>
      {entry.sources.map(s => <p key={s.url}><a href={s.url} target="_blank" rel="noopener noreferrer">{s.title} ↗</a>{s.locator && <small>{s.locator}</small>}</p>)}
    </details>
  </section>;
}
