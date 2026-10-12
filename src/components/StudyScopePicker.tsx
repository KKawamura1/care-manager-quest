import { studyScope } from '../data/study-scope';

const levels = ['大分類', '中分類', '小分類', '引き出し'];
export function StudyScopePicker({ value, onChange, counts, mode, unit }: {
  value: string; onChange: (value: string) => void; counts: ReadonlyMap<string, number>;
  mode: string; unit: string;
}) {
  const path = studyScope.path(value);
  const selectedLabels = path.map(id => {
    const node = studyScope.categories.find(c => c.id === id);
    return node?.label ?? studyScope.concepts.find(c => c.id === id)?.label.split('｜').slice(1).join('｜');
  });
  return <fieldset className="study-scope-picker">
    <legend>学ぶ分類</legend>
    <div className="study-scope-levels">{levels.map((level, depth) => {
      const parent = depth ? path[depth - 1] : undefined;
      const enabled = depth === 0 || Boolean(parent);
      const options = depth === 3
        ? studyScope.concepts.filter(c => c.categoryId === parent)
        : studyScope.categories.filter(c => c.parentId === parent);
      return <label key={level}>{level}
        <select aria-label={`${mode}の${level}`} value={path[depth] ?? 'all'} disabled={!enabled}
          onChange={e => onChange(e.target.value === 'all' ? parent ?? 'all' : e.target.value)}>
          <option value="all">{enabled ? depth ? '配下すべて' : 'すべての大分類' : `先に${levels[depth - 1]}を選択`}</option>
          {enabled && options.map(option => <option key={option.id} value={option.id} disabled={!counts.get(option.id)}>
            {depth === 3 ? option.label.split('｜').slice(1).join('｜') || option.label : option.label}（{counts.get(option.id) ?? 0}{unit}）
          </option>)}
        </select>
      </label>;
    })}</div>
    <p className="study-scope-selection">{path.length ? selectedLabels.join(' → ') : 'すべての分類から出題'}</p>
  </fieldset>;
}
