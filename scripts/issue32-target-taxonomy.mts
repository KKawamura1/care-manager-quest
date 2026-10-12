/** Current 5×28 assignments live only on the annual proposition records.
 * The legacy fields are retained as provenance; they never decide app placement.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { loadYear } from './issue32-revisions.mjs';

export interface TargetAssignment {
  version: '5x28-v1'; proposition_id: string; root_id: string; category_id: string;
  concept_id: string; attribute_id: string; attribute_label: string;
  method: 'legacy_concept' | 'knowledge_rule' | 'individual_review';
  reason: string; source_fingerprint: string; legacy_drawer_id: string;
  candidate_concept_ids: string[]; review_required: boolean;
  scope_qualifier?: string;
}
export interface Proposition {
  year: number; question_number: number; question_id: string;
  choice_index: number; proposition_index: number;
  proposition: string; question_stem: string; subject_concept: string; attribute: string;
  primary_path: string[]; classification_status: string; exam_domain: string;
  knowledge_target_review?: { principle: string; needed_knowledge: string };
  drawer_assignment?: Record<string, unknown>;
  taxonomy_assignment?: TargetAssignment;
  [field: string]: unknown;
}
export interface SmallConcept { id: string; label: string; attribute_examples: string; sample_pattern: string }
export interface SmallCategory { id: string; label: string; concepts: SmallConcept[] }
export const dataUrl = new URL('../docs/taxonomy/issue-32-experiment/', import.meta.url);
const read = (name: string) => readFileSync(new URL(name, dataUrl), 'utf8');
export const targetTaxonomy = JSON.parse(read('taxonomy-5x28.json')) as {
  version: string; nodes: { id: string; label: string; parent_id: string | null; description: string }[];
};
export const smallPlan = JSON.parse(read('small-category-plan.json')) as { categories: SmallCategory[] };
export const smallConcepts = new Map(smallPlan.categories.flatMap(category => category.concepts).map(c => [c.id, c]));
export const targetNodes = new Map(targetTaxonomy.nodes.map(n => [n.id, n]));
assert.equal(targetNodes.size, 33);
assert.equal(targetTaxonomy.nodes.filter(n => n.parent_id === null).length, 5);
assert.equal(smallPlan.categories.length, 28);
assert.equal(smallConcepts.size, smallPlan.categories.flatMap(c => c.concepts).length, 'duplicate proposed concept');
for (const category of smallPlan.categories) {
  assert.equal(targetNodes.get(category.id)?.label, category.label, 'small plan changed fixed middle category');
  for (const concept of category.concepts) assert.ok(concept.id.startsWith(category.id + '.'));
}

export const propositionId = (r: Proposition) => `${r.year}-${String(r.question_number).padStart(2, '0')}/c${r.choice_index}/p${r.proposition_index}`;
export const drawerId = (a: TargetAssignment) => `drawer5.${a.concept_id}#${a.attribute_id}`;
export function targetSourceFingerprint(r: Proposition) {
  const fields = ['year', 'question_id', 'question_number', 'choice_index', 'proposition_index',
    'question_stem', 'source_text', 'proposition', 'subject_concept', 'attribute', 'primary_path',
    'classification_status', 'drawer_assignment', 'knowledge_target_review'];
  return createHash('sha256').update(JSON.stringify(fields.map(f => r[f] ?? null))).digest('hex');
}
export function validateTargetAssignment(r: Proposition): TargetAssignment {
  const a = r.taxonomy_assignment;
  const id = propositionId(r);
  assert.ok(a, 'missing 5x28 assignment: ' + id);
  assert.equal(a.version, targetTaxonomy.version, 'invalid assignment version: ' + id);
  assert.equal(a.proposition_id, id, 'assignment belongs to another proposition: ' + id);
  assert.equal(a.source_fingerprint, targetSourceFingerprint(r), 'stale 5x28 assignment; review changed knowledge: ' + id);
  assert.ok(smallConcepts.has(a.concept_id), 'unknown small concept: ' + id);
  assert.equal(a.concept_id.split('.').slice(0, 2).join('.'), a.category_id, 'small/middle mismatch: ' + id);
  assert.equal(targetNodes.get(a.category_id)?.parent_id, a.root_id, 'middle/root mismatch: ' + id);
  assert.match(a.attribute_id, /^[a-z][a-z0-9_]*$/, 'invalid attribute ID: ' + id);
  assert.ok(a.attribute_label?.trim() && a.reason?.trim() && a.legacy_drawer_id?.trim(), 'missing assignment evidence: ' + id);
  assert.ok(['legacy_concept', 'knowledge_rule', 'individual_review'].includes(a.method), 'invalid assignment method: ' + id);
  assert.equal(typeof a.review_required, 'boolean', 'missing review flag: ' + id);
  assert.ok(Array.isArray(a.candidate_concept_ids));
  assert.equal(new Set(a.candidate_concept_ids).size, a.candidate_concept_ids.length, 'duplicate candidates: ' + id);
  for (const c of a.candidate_concept_ids) assert.ok(smallConcepts.has(c), 'unknown candidate: ' + id);
  return a;
}
export function loadTargetRows(): Proposition[] {
  return Array.from({ length: 21 }, (_, i) => loadYear(2005 + i)).flat();
}

export function buildTargetIndex() {
  const index: { proposition_id: string; canonical_question_id: string; choice_index: number;
    primary_drawer_id: string; classification_semantic_reviewed: boolean; migration_review_required: boolean }[] = [];
  const drawers = new Map<string, { id: string; root: string; category_id: string; concept_id: string;
    concept_label: string; attribute_id: string; attribute_label: string; review_required: boolean; proposition_count: number }>();
  const seen = new Set<string>();
  const rows = loadTargetRows();
  for (const r of rows) {
    const a = validateTargetAssignment(r), id = propositionId(r);
    assert.ok(!seen.has(id), 'duplicate proposition: ' + id); seen.add(id);
    const small = smallConcepts.get(a.concept_id)!;
    const key = drawerId(a);
    const d = drawers.get(key) ?? { id: key, root: a.root_id, category_id: a.category_id,
      concept_id: a.concept_id, concept_label: small.label, attribute_id: a.attribute_id,
      attribute_label: a.attribute_label, review_required: false, proposition_count: 0 };
    assert.equal(d.attribute_label, a.attribute_label, 'inconsistent attribute label: ' + key);
    d.review_required ||= a.review_required; d.proposition_count++; drawers.set(key, d);
    index.push({ proposition_id: id, canonical_question_id: `${r.year}-${String(r.question_number).padStart(2, '0')}`,
      choice_index: r.choice_index, primary_drawer_id: key,
      classification_semantic_reviewed: r.knowledge_target_review?.principle === 'judgment_knowledge_over_context',
      migration_review_required: a.review_required });
  }
  assert.equal(index.length, 6346);
  const conceptCount = new Set([...drawers.values()].map(d => d.concept_id)).size;
  const summary = { root_count: 5, middle_category_count: 28, proposed_concept_count: smallConcepts.size,
    active_concept_count: conceptCount, drawer_count: drawers.size, proposition_count: rows.length,
    migration_review_required: rows.filter(r => r.taxonomy_assignment!.review_required).length,
    semantic_reviewed: index.filter(r => r.classification_semantic_reviewed).length };
  return { index, drawer_registry: [...drawers.values()].sort((a, b) => a.id.localeCompare(b.id)), summary, rows };
}
