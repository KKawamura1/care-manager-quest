import { useMemo } from 'react';
import { categories, concepts } from '../data/knowledge';
import { conceptStatus } from '../domain/game';
import type { ConceptProgress } from '../domain/models';

export function KnowledgeMap({ progress, onSelect }: {
  progress: Record<string, ConceptProgress>; onSelect: (id:string) => void;
}) {
  const tree = useMemo(() => {
    const children = new Map<string, typeof categories>();
    const drawers = new Map<string, typeof concepts>();
    for (const category of categories) {
      const parent = category.parentId ?? '';
      children.set(parent, [...(children.get(parent) ?? []), category]);
    }
    for (const concept of concepts) drawers.set(concept.categoryId, [...(drawers.get(concept.categoryId) ?? []), concept]);
    const descendants = (id:string): typeof concepts => [
      ...(drawers.get(id) ?? []), ...(children.get(id) ?? []).flatMap(c => descendants(c.id)),
    ];
    return { children, drawers, descendants };
  }, []);
  function branch(id:string): React.ReactNode {
    const category = categories.find(c => c.id === id)!;
    const nodes = tree.descendants(id);
    const leaves = tree.drawers.get(id) ?? [];
    return <details key={id} className={id.startsWith('concept5.') ? 'knowledge-small' : 'knowledge-middle'}>
      <summary><span>{category.label}</span><small>{nodes.filter(c => conceptStatus(progress[c.id]) === 'mastered').length} / {nodes.length || '—'}</small></summary>
      {(tree.children.get(id) ?? []).map(c => branch(c.id))}
      {leaves.length > 0 && <div className="concept-grid">{leaves.map(c => {
        const status = conceptStatus(progress[c.id]);
        return <button className={`concept-node ${status}`} key={c.id} onClick={() => onSelect(c.id)}>
          <span>{status === 'mastered' ? '●' : status === 'learning' ? '◐' : '○'}</span>
          <span>{c.label.split('｜').slice(1).join('｜')}</span><span>›</span>
        </button>;
      })}</div>}
    </details>;
  }
  return <>{(tree.children.get('') ?? []).map(root => <section key={root.id} className="map-region">
    <div className="region-heading"><span>{root.id}</span><div><h2>{root.label}</h2></div></div>
    {(tree.children.get(root.id) ?? []).map(c => branch(c.id))}
  </section>)}</>;
}
