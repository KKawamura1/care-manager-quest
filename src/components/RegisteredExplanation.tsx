import type { ExplanationTarget } from '../domain/appExplanation';
import { registeredExplanationHistory, registeredQuestionChoices } from '../data/registered-explanations';

export function RegisteredExplanation({ target }: { target: ExplanationTarget }) {
  const [current,...previous] = registeredExplanationHistory(target);
  const choices = target.choiceId === undefined ? registeredQuestionChoices(target.questionId) : [];
  if (!current && !choices.length) return null;
  return <section className="registered-explanation" aria-label="登録した解説">
    <h3>解説</h3>{current && <p className="registered-explanation-text">{current.explanation}</p>}
    {Boolean(current?.sources?.length) && <details><summary>参考資料</summary>{current!.sources!.map(s => <p key={s.url}><a href={s.url} target="_blank" rel="noopener noreferrer">{s.title} ↗</a></p>)}</details>}
    {previous.length > 0 && <details><summary>以前の登録（{previous.length}件）</summary>{previous.map(e => <div key={e.registrationId}><time dateTime={e.registeredAt}>{e.registeredAt.slice(0,10)}</time><p>{e.explanation}</p></div>)}</details>}
    {choices.length > 0 && <details><summary>選択肢別の登録解説（{choices.length}件）</summary>{choices.map(choice => <div key={choice.choiceId}>
      <b>選択肢{choice.choiceId}：{choice.truth ? '○' : '×'}</b><RegisteredExplanation target={choice.target}/>
    </div>)}</details>}
  </section>;
}
