import { useMemo, useState } from 'react';
import { swipeCards } from '../data/swipe-provider';
import { studyScope } from '../data/study-scope';
import type { LearningEvent } from '../domain/models';
import { fieldStats, type FieldStats as Stats } from '../domain/fieldStats';

const labels = { unseen: '未学習', insufficient: '判定前', strong: '得意', weak: '苦手', developing: '学習中' };
const percent = (value: number | null) => value === null ? '—' : value > 0 && value < .01 ? '1%未満' : `${Math.round(value * 100)}%`;

function Metrics({ stats }: { stats: Stats }) {
  return <>
    <div className="field-metrics"><div><b>{percent(stats.accuracy)}</b><span>正答率</span></div><div><b>{percent(stats.recentAccuracy)}</b><span>最近の正答率</span></div><div><b>{percent(stats.coverage)}</b><span>学習済み</span></div></div>
    <div className="field-coverage" role="progressbar" aria-label="学習済みの割合" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(stats.coverage * 100)}><span style={{ width: `${stats.coverage * 100}%` }}/></div>
    <p className="field-counts">{stats.correct} / {stats.answers}回答 正解 · {stats.studiedCards} / {stats.totalCards}枚 学習済み</p>
  </>;
}

export function FieldStats({ events }: { events: readonly LearningEvent[] }) {
  const stats = useMemo(() => fieldStats(swipeCards, events, studyScope), [events]);
  const [selected, setSelected] = useState('all');
  const [sort, setSort] = useState('default');
  const categories = studyScope.categories;
  const nodes = [...categories, ...studyScope.concepts];
  const label = (id: string) => id === 'all' ? '全分野' : nodes.find(node => node.id === id)!.label.split('｜').at(-1)!;
  const path = ['all', ...studyScope.path(selected)];
  const children = selected === 'all' ? categories.filter(node => !node.parentId) : [
    ...categories.filter(node => node.parentId === selected), ...studyScope.concepts.filter(node => node.categoryId === selected),
  ];
  const rows = [...children].sort((a, b) => {
    if (sort === 'default') return 0;
    const left = stats.get(a.id)!, right = stats.get(b.id)!;
    // Unanswered fields remain separate from measured weaknesses.
    if (left.recentAccuracy === null || right.recentAccuracy === null) return Number(left.recentAccuracy === null) - Number(right.recentAccuracy === null);
    return sort === 'weak' ? left.recentAccuracy - right.recentAccuracy : right.recentAccuracy - left.recentAccuracy;
  });
  return <section className="field-stats" aria-label="分野別の得意・苦手">
    <h2>分野別の得意・苦手</h2>
    <nav className="field-breadcrumbs" aria-label="集計する分野">{path.map(id => <button key={id} onClick={() => setSelected(id)} aria-current={id === selected ? 'page' : undefined}>{label(id)}</button>)}</nav>
    <article className="field-overview"><div className="field-heading"><h3>{label(selected)}</h3><span className={`field-status ${stats.get(selected)!.status}`}>{labels[stats.get(selected)!.status]}</span></div><Metrics stats={stats.get(selected)!}/></article>
    {!stats.get(selected)!.answers && <p className="field-empty">学習すると、ここに正答率と得意・苦手が表示されます。</p>}
    {rows.length > 0 && <>
      <label className="field-sort">並び順<select value={sort} onChange={event => setSort(event.target.value)}><option value="default">分類順</option><option value="weak">苦手な順</option><option value="strong">得意な順</option></select></label>
      <div className="field-list">{rows.map(node => {
        const value = stats.get(node.id)!;
        const expandable = categories.some(child => child.parentId === node.id) || studyScope.concepts.some(child => child.categoryId === node.id);
        return <article className="field-row" key={node.id}>
          <div className="field-heading">{expandable ? <button onClick={() => setSelected(node.id)} aria-label={`${label(node.id)}の内訳を見る`}>{label(node.id)}<span aria-hidden="true">›</span></button> : <h3>{label(node.id)}</h3>}<span className={`field-status ${value.status}`}>{labels[value.status]}</span></div>
          <Metrics stats={value}/>
        </article>;
      })}</div>
    </>}
    <details className="help-details"><summary>集計と判定の見方</summary><p>全年度の○×・5択を選択肢単位で集計。同じカードは日本時間の1日最初の回答だけを数え、「わからない」は不正解に含めます。正誤が改訂されたカードは改訂後の回答を使います。</p><p>正答率は全履歴。最近の正答率は各カードの直近5日分までの回答から正答率を求め、学習済みカード間で平均します。未学習カードは正答率に含めず、学習済みの割合で確認できます。</p><p>5枚以上・10回答以上で判定し、最近の正答率80%以上を得意、60%未満を苦手、その間を学習中と表示します。判定は学習済みの範囲の目安です。複数分野に属するカードは各分野で数えるため、内訳の合計は全体と一致しない場合があります。</p></details>
  </section>;
}
