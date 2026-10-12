import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildIndex } from './normalize-issue32-ids.mjs';
import { dataUrl, loadTargetRows, propositionId, type Proposition } from './issue32-target-taxonomy.mts';
import { suggestTarget, type LegacyDrawer } from './issue32-small-category-rules.mts';

export function suggestAll(rows: Proposition[] = loadTargetRows()) {
  const old = buildIndex();
  const drawers = new Map(old.drawer_registry.map(d => [d.id, d as LegacyDrawer]));
  const index = new Map(old.index.map(r => [r.proposition_id, r]));
  const errors: { id: string; error: string }[] = [];
  const output = rows.map(row => {
    try {
      const oldEntry = index.get(propositionId(row));
      const oldId = oldEntry?.primary_drawer_id;
      assert.ok(oldId && drawers.has(oldId), 'missing legacy primary drawer');
      return { ...row, taxonomy_assignment:suggestTarget(row, { ...drawers.get(oldId)!, review_required:oldEntry!.drawer_review_required }) };
    } catch (e) { errors.push({ id:propositionId(row), error:String(e) }); return row; }
  });
  return { output, errors };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const writing = process.argv.includes('--write');
  assert.ok(process.argv.slice(2).every(a => ['--write','--dry-run'].includes(a)));
  const { output, errors } = suggestAll();
  if (errors.length) {
    console.log(JSON.stringify(errors, null, 2));
    assert.ok(!writing, 'refusing partial migration');
  } else if (writing) {
    for (let year=2005;year<=2025;year++) writeFileSync(new URL(`propositions/${year}.jsonl`,dataUrl),
      output.filter(r => r.year === year).map(r => JSON.stringify(r)).join('\n') + '\n');
  }
  const counts = new Map<string,number>();
  for (const row of output) if (row.taxonomy_assignment) counts.set(row.taxonomy_assignment.category_id,
    (counts.get(row.taxonomy_assignment.category_id) ?? 0) + 1);
  console.log(JSON.stringify({ propositions:output.length, unmapped:errors.length, categories:Object.fromEntries(counts) }));
}
