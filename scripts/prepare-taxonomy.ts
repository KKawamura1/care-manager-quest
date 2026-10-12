// PR33's annual JSONL files are the only editable classification source.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { buildTargetIndex, targetTaxonomy } from './issue32-target-taxonomy.mts';

interface Drawer {
  id: string; root: string; category_id: string; concept_id: string; concept_label: string;
  attribute_label: string; review_required: boolean;
}
interface Assignment {
  canonical_question_id: string; choice_index: number; primary_drawer_id: string | null;
  classification_semantic_reviewed: boolean;
  migration_review_required: boolean;
}
interface Choice { drawerIds: string[]; reviewed: boolean }
const result = buildTargetIndex() as { drawer_registry: Drawer[]; index: Assignment[] };
const categories = targetTaxonomy.nodes.map(n => ({ id:n.id, ...(n.parent_id ? {parentId:n.parent_id} : {}),
  label:n.label, description:n.description, available:true })) as {
  id: string; parentId?: string; label: string; description: string; available: boolean;
}[];
const groups = new Map<string, Drawer[]>();
const categoryFor = (d: Drawer) => `concept5.${d.concept_id}`;
for (const d of result.drawer_registry) {
  const id = categoryFor(d);
  if (!groups.has(id)) {
    groups.set(id, []);
    categories.push({ id, parentId: d.category_id, label: d.concept_label, description: '', available: true });
  }
  groups.get(id)!.push(d);
}
const concepts = result.drawer_registry.map(d => ({
  id: d.id, categoryId: categoryFor(d), label: `${d.concept_label}｜${d.attribute_label}`,
  summary: '', relatedIds: groups.get(categoryFor(d))!.filter(other => other.id !== d.id).map(other => other.id),
  reviewRequired: d.review_required,
}));
const choices: Record<string, Choice> = {};
for (const row of result.index) {
  const key = `${row.canonical_question_id}:${row.choice_index}`;
  const choice = choices[key] ??= { drawerIds: [], reviewed: true };
  if (row.primary_drawer_id && !choice.drawerIds.includes(row.primary_drawer_id)) choice.drawerIds.push(row.primary_drawer_id);
  choice.reviewed &&= row.classification_semantic_reviewed && !row.migration_review_required;
}
const byId = new Map(concepts.map(c => [c.id, c]));
const questions: Record<string, { title: string; primaryCategory: string; conceptIds: string[] }> = {};
for (let year = 2005; year <= 2025; year++) for (let number = 1; number <= 60; number++) {
  const key = `${year}-${String(number).padStart(2, '0')}`;
  const ids = [...new Set(Array.from({ length: 5 }, (_, i) => choices[`${key}:${i + 1}`].drawerIds).flat())];
  assert.ok(ids.length && ids.every(id => byId.has(id)), key + ': missing classification');
  const labels = [...new Set(ids.map(id => byId.get(id)!.label.split('｜')[0]))];
  questions[key] = { title: labels.slice(0, 2).join('・'), primaryCategory: byId.get(ids[0])!.categoryId, conceptIds: ids };
}
assert.equal(Object.keys(choices).length, 6300);
const payload = { categories, concepts, questions, choices };
const fingerprint = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
const output = JSON.stringify({ source: 'PR68-derived-5x28', fingerprint, revision: 5, ...payload }) + '\n';
const path = new URL('../src/data/packs/knowledge.json', import.meta.url);
if (process.argv.includes('--check')) assert.equal(readFileSync(path, 'utf8'), output, 'Application taxonomy is stale; run npm run prepare:questions');
else writeFileSync(path, output);
console.log(`Prepared 5x28 taxonomy: ${groups.size} concepts, ${concepts.length} drawers, 6300 choices.`);
