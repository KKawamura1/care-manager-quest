import type { Category, Concept } from './models';

export interface StudyItem { topicIds: readonly string[] }
export interface StudyScope {
  categories: readonly Category[];
  concepts: readonly Concept[];
  path: (id: string) => string[];
  matches: (topicIds: readonly string[], scope: string) => boolean;
  counts: (items: readonly StudyItem[]) => Map<string, number>;
}

// A scope is either a category (at any depth) or an individual drawer.
// Count each card/question once per ancestor, even with several matching drawers.
export function buildStudyScope(categories: readonly Category[], concepts: readonly Concept[]): StudyScope {
  const categoryById = new Map(categories.map(c => [c.id, c]));
  const paths = new Map<string, string[]>();
  for (const category of categories) {
    const path: string[] = [], visited = new Set<string>();
    let node: Category | undefined = category;
    while (node) {
      if (visited.has(node.id)) throw new Error(`Cyclic study category: ${node.id}`);
      visited.add(node.id); path.unshift(node.id);
      node = node.parentId ? categoryById.get(node.parentId) : undefined;
    }
    paths.set(category.id, path);
  }
  const ancestors = new Map<string, ReadonlySet<string>>();
  for (const concept of concepts) {
    const path = [...(paths.get(concept.categoryId) ?? []), concept.id];
    paths.set(concept.id, path); ancestors.set(concept.id, new Set(path));
  }
  return {
    categories, concepts,
    path: id => [...(paths.get(id) ?? [])],
    matches: (topicIds, scope) => scope === 'all' || topicIds.some(id => ancestors.get(id)?.has(scope)),
    counts: items => {
      const counts = new Map<string, number>([['all', items.length]]);
      for (const item of items) {
        const scopes = new Set(item.topicIds.flatMap(id => [...(ancestors.get(id) ?? [])]));
        for (const id of scopes) counts.set(id, (counts.get(id) ?? 0) + 1);
      }
      return counts;
    },
  };
}

export function parseStudyScope(value: string | null, index: StudyScope): string {
  return value && index.path(value).length ? value : 'all';
}
