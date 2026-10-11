/**
 * Non-destructive ID normalization for PR #33 experimental propositions.
 *
 * Usage:
 *   node scripts/normalize-issue32-ids.mjs --check
 *   node scripts/normalize-issue32-ids.mjs --jsonl > /tmp/issue32-normalized-ids.jsonl
 *   node scripts/normalize-issue32-ids.mjs --report
 *
 * Does NOT rewrite source question IDs, free-text classification paths, or
 * taxonomy-v1.1 nodes. The normalized IDs are an explicitly derived view.
 */
import assert from 'node:assert/strict';
import { identifyDrawer } from './issue32-drawers.mjs';
import { loadYear } from './issue32-revisions.mjs';
import { createHash } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(dirname(fileURLToPath(import.meta.url))), 'docs/taxonomy/issue-32-experiment');
const read = (file) => readFileSync(join(dir, file), 'utf8');
const taxonomy = JSON.parse(read('taxonomy-v1.1.json'));
const nodes = new Map(taxonomy.nodes.map((node) => [node.id, node]));
assert.equal(nodes.size, taxonomy.nodes.length, 'duplicate canonical taxonomy ID');

export const ROOTS = Object.freeze({
  '1': '人の健康と生活',
  '2': '支援の考え方と方法',
  '3': '支援の提供体制',
  '4': '社会保障の仕組み',
});

export function canonicalQuestionId(row) {
  assert.ok(Number.isInteger(row.year) && row.year >= 2005 && row.year <= 2025, 'invalid year');
  assert.ok(Number.isInteger(row.question_number) && row.question_number >= 1 && row.question_number <= 60,
    'invalid question number');
  const canonical = row.year + '-' + String(row.question_number).padStart(2, '0');
  // The 2020 source question pack uses this different, stable external ID format.
  const legacy2020 = 'care_manager_2020_' + String(row.question_number).padStart(3, '0');
  assert.ok(row.question_id === canonical || (row.year === 2020 && row.question_id === legacy2020),
    'unexpected source question ID: ' + row.question_id + ' (expected ' + canonical + ')');
  return canonical;
}

export function canonicalPropositionId(row) {
  assert.ok(Number.isInteger(row.choice_index) && row.choice_index >= 1 && row.choice_index <= 5);
  assert.ok(Number.isInteger(row.proposition_index) && row.proposition_index >= 1);
  return canonicalQuestionId(row) + '/c' + row.choice_index + '/p' + row.proposition_index;
}

function validatePath(path) {
  assert.ok(Array.isArray(path) && path.length >= 2 && path.every((x) => typeof x === 'string' && x.length > 0),
    'invalid classification path');
  assert.equal(path[1], ROOTS[path[0]], 'invalid root ID-label pair: ' + JSON.stringify(path.slice(0, 2)));
}

/**
 * A path ID is a *locator* for one exact, observed v1.0 path, not a semantic
 * v1.1 node ID. It changes if that path's label or structure changes.
 */
export function observedPathId(path) {
  validatePath(path);
  return 'path32.' + createHash('sha256').update(JSON.stringify(path), 'utf8').digest('hex').slice(0, 24);
}

/**
 * Only ID-label pairs matching the actual v1.1 registry and its ancestor
 * chain are admitted. In particular 1.2/1.3/3.4 have changed meanings in
 * some legacy records. A matching ancestor is NOT an exact leaf match.
 */
export function inspectPath(path) {
  validatePath(path);
  const verified = new Set();
  const conflicts = [];
  let anchor = null;
  let exact = null;
  for (let i = 0; i + 1 < path.length; i++) {
    const id = path[i];
    const node = nodes.get(id);
    if (!node) continue;
    const actualLabel = path[i + 1];
    if (node.label !== actualLabel) {
      // Only explicit ID-looking tokens can be mistaken for a node ID.
      if (/^[1-4](?:\.[a-z0-9_]+)*$/.test(id)) {
        conflicts.push({ code: id, observed_label: actualLabel, canonical_label: node.label });
      }
      continue;
    }
    if (node.parent_id !== null && !verified.has(node.parent_id)) {
      conflicts.push({ code: id, observed_label: actualLabel, missing_parent: node.parent_id });
      continue;
    }
    verified.add(id);
    anchor = id;
    if (i + 1 === path.length - 1) exact = id;
  }
  return {
    path_id: observedPathId(path),
    taxonomy_v1_1_anchor_id: anchor,
    taxonomy_v1_1_exact_node_id: exact,
    v1_1_conflicts: conflicts,
  };
}

export function normalizeIds(row) {
  const questionId = canonicalQuestionId(row);
  const propositionId = canonicalPropositionId(row);
  const primary = row.primary_path.length ? inspectPath(row.primary_path) : null;
  const candidates = (row.candidate_paths || []).map(inspectPath);
  const drawer = row.primary_path.length ? identifyDrawer(row, row.primary_path) : null;
  const candidateDrawers = (row.candidate_paths || []).map((path) => identifyDrawer(row, path));
  assert.ok(row.classification_status === 'assigned' ? primary !== null : primary === null,
    'invalid classification primary path: ' + propositionId);
  if (row.classification_status === 'ambiguous') {
    assert.ok(candidates.length >= 2, 'ambiguous proposition missing candidates: ' + propositionId);
  }
  return {
    proposition_id: propositionId,
    canonical_question_id: questionId,
    source_question_id: row.question_id,
    choice_index: row.choice_index,
    proposition_index: row.proposition_index,
    classification_status: row.classification_status,
    primary_path_id: primary?.path_id ?? null,
    primary_v1_1_anchor_id: primary?.taxonomy_v1_1_anchor_id ?? null,
    primary_v1_1_exact_node_id: primary?.taxonomy_v1_1_exact_node_id ?? null,
    candidate_path_ids: candidates.map((c) => c.path_id),
    candidate_v1_1_anchor_ids: candidates.map((c) => c.taxonomy_v1_1_anchor_id),
    primary_drawer_id: drawer?.id ?? null,
    candidate_drawer_ids: candidateDrawers.map((d) => d.id),
    candidate_attribute_ids: drawer?.candidate_attribute_ids ?? [],
    drawer_assignment_reviewed: drawer?.individually_reviewed ?? false,
    drawer_review_reason: drawer?.review_reason ?? null,
    classification_semantic_reviewed: row.knowledge_target_review?.principle === 'judgment_knowledge_over_context',
    drawer_review_required: row.classification_status !== 'assigned' ||
      (drawer?.review_required ?? candidateDrawers.some((d) => d.review_required)),
  };
}

export function buildIndex(options = {}) {
  const index = [], seenPropositions = new Set(), seenPaths = new Map();
  const mismatched = new Map(), conflicts = new Map(), v11Exact = new Map();
  const drawers = new Map(), pathToDrawers = new Map(), concepts = new Set();
  const propositionReview = [];
  const summary = {
    years: [2005, 2025],
    question_count: 0,
    proposition_count: 0,
    legacy_source_question_count: 0,
    legacy_source_proposition_count: 0,
    observed_path_count: 0,
    conflicting_v1_1_path_count: 0,
    exact_v1_1_path_count: 0,
    normalized_drawer_count: 0,
    concept_count: 0,
    unresolved_attribute_drawers: 0,
    provisional_concept_drawers: 0,
    proposition_inferred_drawers: 0,
    classification_semantically_reviewed_propositions: 0,
    individually_reviewed_drawer_assignments: 0,
    unresolved_attribute_propositions: 0,
    provisional_concept_propositions: 0,
    inferred_assignment_propositions: 0,
    reviewed_rule_drawer_count: 0,
    normalization_review_required_drawers: 0,
    normalization_review_required_propositions: 0,
    collapsed_original_path_count: 0,
  };
  for (let year = 2005; year <= 2025; year++) {
    const rows = loadYear(year, { baselineOnly: options.baselineOnly ?? false });
    const questions = new Map(), choices = new Map();
    for (const row of rows) {
      assert.equal(row.year, year, 'file-year mismatch');
      const output = normalizeIds(row);
      assert.ok(!seenPropositions.has(output.proposition_id), 'duplicate ID: ' + output.proposition_id);
      seenPropositions.add(output.proposition_id);
      index.push(output);
      if (output.classification_semantic_reviewed) summary.classification_semantically_reviewed_propositions++;
      if (output.drawer_assignment_reviewed) summary.individually_reviewed_drawer_assignments++;
      const primaryDrawer = row.primary_path.length ? identifyDrawer(row, row.primary_path) : null;
      if (primaryDrawer?.attribute_resolution === 'unresolved') summary.unresolved_attribute_propositions++;
      if (primaryDrawer?.concept_resolution === 'provisional') summary.provisional_concept_propositions++;
      if (primaryDrawer?.attribute_resolution === 'inferred' || primaryDrawer?.concept_resolution === 'inferred') summary.inferred_assignment_propositions++;
      if (output.drawer_review_required) propositionReview.push({
        ...output, proposition:row.proposition, question_stem:row.question_stem,
        subject_concept:row.subject_concept, attribute:row.attribute,
        source_primary_path:row.primary_path, source_candidate_paths:row.candidate_paths??[],
        concept_resolution:primaryDrawer?.concept_resolution??null,
        attribute_resolution:primaryDrawer?.attribute_resolution??null,
      });
      if (output.drawer_review_required) summary.normalization_review_required_propositions++;
      for (const path of [row.primary_path, ...(row.candidate_paths || [])]) {
        if (!path.length) continue;
        const drawer = identifyDrawer(row, path);
        const pathId = observedPathId(path);
        concepts.add(drawer.root + '/' + drawer.concept_id);
        if (!drawers.has(drawer.id)) drawers.set(drawer.id, {
          ...drawer, proposition_count: 0, original_path_ids: new Set(), examples: [], source_subjects: new Set(),
          attribute_evidence_set:new Set(), concept_evidence_set:new Set(), candidate_attribute_ids_set:new Set(),
        });
        const group = drawers.get(drawer.id);
        assert.equal(group.concept_label, drawer.concept_label, 'inconsistent concept label: '+drawer.id);
        assert.equal(group.attribute_label, drawer.attribute_label, 'inconsistent attribute label: '+drawer.id);
        if (drawer.attribute_evidence) group.attribute_evidence_set.add(drawer.attribute_evidence);
        if (drawer.concept_evidence) group.concept_evidence_set.add(drawer.concept_evidence);
        for (const candidate of drawer.candidate_attribute_ids) group.candidate_attribute_ids_set.add(candidate);
        group.individually_reviewed &&= drawer.individually_reviewed;
        if (group.review_reason !== drawer.review_reason) group.review_reason = null;
        // An existing drawer can be reached by many years and by rules with
        // different confidence. Aggregate conservatively: one uncertain
        // occurrence makes the shared drawer a review target.
        group.review_required ||= drawer.review_required || row.classification_status !== 'assigned';
        if (group.attribute_resolution !== drawer.attribute_resolution) group.attribute_resolution = 'mixed';
        if (group.concept_resolution !== drawer.concept_resolution) group.concept_resolution = 'mixed';
        group.proposition_count++;
        group.original_path_ids.add(pathId);
        group.source_subjects.add(row.subject_concept);
        if (group.examples.length < 3) {
          group.examples.push({ question_id: row.question_id, choice_index: row.choice_index,
            proposition_index: row.proposition_index, proposition: row.proposition });
        }
        if (!pathToDrawers.has(pathId)) pathToDrawers.set(pathId, new Set());
        pathToDrawers.get(pathId).add(drawer.id);
      }
      questions.set(output.canonical_question_id, (questions.get(output.canonical_question_id) || new Set()).add(row.choice_index));
      const choiceId = output.canonical_question_id + '/' + row.choice_index;
      (choices.get(choiceId) || (choices.set(choiceId, []), choices.get(choiceId))).push(row.proposition_index);
      if (output.source_question_id !== output.canonical_question_id) {
        mismatched.set(output.source_question_id, output.canonical_question_id);
        summary.legacy_source_proposition_count++;
      }
      for (const path of [row.primary_path, ...(row.candidate_paths || [])]) {
        if (!path.length) continue;
        const result = inspectPath(path);
        const key = JSON.stringify(path);
        const previous = seenPaths.get(result.path_id);
        assert.ok(!previous || previous === key, 'observed path ID collision: ' + result.path_id);
        seenPaths.set(result.path_id, key);
        if (result.v1_1_conflicts.length) conflicts.set(result.path_id, result);
        if (result.taxonomy_v1_1_exact_node_id) v11Exact.set(result.path_id, result.taxonomy_v1_1_exact_node_id);
      }
    }
    assert.equal(questions.size, 60, 'question count: ' + year);
    assert.equal(choices.size, 300, 'choice count: ' + year);
    for (const [question, variants] of questions) assert.equal(variants.size, 5, question);
    for (const [choice, variants] of choices) {
      variants.sort((a, b) => a - b);
      assert.deepEqual(variants, Array.from({ length: variants.length }, (_, i) => i + 1), choice);
    }
    summary.question_count += questions.size;
  }
  summary.proposition_count = index.length;
  summary.legacy_source_question_count = mismatched.size;
  summary.observed_path_count = seenPaths.size;
  summary.conflicting_v1_1_path_count = conflicts.size;
  summary.exact_v1_1_path_count = v11Exact.size;
  summary.normalized_drawer_count = drawers.size;
  summary.concept_count = concepts.size;
  summary.unresolved_attribute_drawers = [...drawers.values()]
    .filter((d) => ['unresolved','mixed'].includes(d.attribute_resolution)).length;
  summary.provisional_concept_drawers = [...drawers.values()]
    .filter((d) => ['provisional','mixed','unresolved'].includes(d.concept_resolution)).length;
  summary.proposition_inferred_drawers = [...drawers.values()]
    .filter((d) => d.attribute_evidence_set.has('proposition_keyword') || d.concept_evidence_set.has('one_named_disease')).length;
  summary.reviewed_rule_drawer_count = [...drawers.values()].filter((d) => !d.review_required).length;
  summary.normalization_review_required_drawers = drawers.size - summary.reviewed_rule_drawer_count;
  summary.collapsed_original_path_count = [...drawers.values()]
    .filter((d) => d.original_path_ids.size > 1).reduce((n, d) => n + d.original_path_ids.size, 0);
  assert.equal(summary.question_count, 1260);
  assert.equal(summary.proposition_count, 6346);
  assert.equal(summary.legacy_source_question_count, 60);
  assert.equal(summary.legacy_source_proposition_count, 301);
  assert.ok(summary.normalized_drawer_count < summary.observed_path_count,
    'No classification path consolidation: normalized drawers should reuse concepts and attributes');
  assert.ok(summary.reviewed_rule_drawer_count > 0, 'No controlled concept/attribute drawers');
  assert.equal(mismatched.get('care_manager_2020_001'), '2020-01');
  assert.equal(mismatched.get('care_manager_2020_060'), '2020-60');
  return {
    index,
    proposition_review:propositionReview,
    summary,
    question_aliases: [...mismatched].sort((a, b) => a[0].localeCompare(b[0])).map(([source, canonical]) => ({ source, canonical })),
    path_registry: [...seenPaths].sort((a, b) => a[0].localeCompare(b[0]))
      .map(([id, path]) => ({ id, path: JSON.parse(path) })),
    v1_1_conflict_examples: [...conflicts.values()].slice(0, 15),
    drawer_registry: [...drawers.values()].map((d) => {
      const {attribute_evidence_set,concept_evidence_set,candidate_attribute_ids_set,...entry}=d;
      return ({
      ...entry,
      attribute_evidences:[...attribute_evidence_set].sort(),
      concept_evidences:[...concept_evidence_set].sort(),
      candidate_attribute_ids:[...candidate_attribute_ids_set].sort(),
      original_path_ids: [...d.original_path_ids].sort(),
      original_path_count: d.original_path_ids.size,
      source_subjects: [...d.source_subjects].sort(),
    }); }).sort((a, b) => a.id.localeCompare(b.id)),
    path_drawer_relations: [...pathToDrawers].map(([path_id, ids]) => ({
      path_id, drawer_ids: [...ids].sort(),
    })).sort((a, b) => a.path_id.localeCompare(b.path_id)),
  };
}

export function writeArtifacts(outputDir, result = buildIndex()) {
  mkdirSync(outputDir, {recursive:true});
  const jsonl = (name, entries) => writeFileSync(join(outputDir,name), entries.map(entry=>JSON.stringify(entry)).join('\n')+'\n');
  jsonl('proposition-drawer-index.jsonl',result.index);
  jsonl('knowledge-drawers.jsonl',result.drawer_registry);
  jsonl('original-path-to-drawers.jsonl',result.path_drawer_relations);
  jsonl('review-required-drawers.jsonl',result.drawer_registry.filter(d=>d.review_required));
  jsonl('review-required-propositions.jsonl',result.proposition_review);
  jsonl('original-paths.jsonl',result.path_registry);
  writeFileSync(join(outputDir,'question-id-aliases.json'),JSON.stringify(result.question_aliases,null,2)+'\n');
  writeFileSync(join(outputDir,'normalization-report.json'),JSON.stringify({summary:result.summary,v1_1_conflict_examples:result.v1_1_conflict_examples},null,2)+'\n');
}

const command = process.argv[2] ?? '--check';
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (command.startsWith('--output-dir=')) {
    assert.equal(process.argv.length,3,'unexpected extra arguments');
    assert.ok(command.slice('--output-dir='.length),'empty output directory');
    writeArtifacts(command.slice('--output-dir='.length));
    console.log('Normalized drawer artifacts written');
    process.exit(0);
  }
  assert.ok(['--check', '--jsonl', '--report', '--aliases', '--paths', '--drawers', '--review', '--path-drawers', '--audit'].includes(command),
    'Usage: normalize-issue32-ids.mjs [--check|--jsonl|--report|--aliases|--paths|--drawers|--review|--path-drawers]');
  assert.equal(process.argv.length, 3, 'unexpected extra arguments');
  const { index, summary, question_aliases, path_registry, v1_1_conflict_examples, drawer_registry, path_drawer_relations } = buildIndex();
  if (command === '--jsonl') for (const entry of index) console.log(JSON.stringify(entry));
  if (command === '--paths') for (const entry of path_registry) console.log(JSON.stringify(entry));
  if (command === '--aliases') console.log(JSON.stringify(question_aliases, null, 2));
  if (command === '--drawers') for (const entry of drawer_registry) console.log(JSON.stringify(entry));
  if (command === '--review') for (const entry of drawer_registry) if (entry.review_required) console.log(JSON.stringify(entry));
  if (command === '--path-drawers') for (const entry of path_drawer_relations) console.log(JSON.stringify(entry));
  if (command === '--report') console.log(JSON.stringify({ summary, v1_1_conflict_examples }, null, 2));
  if (command === '--audit') console.log(JSON.stringify(drawer_registry.filter((d) => d.review_required)
    .sort((a,b)=>b.proposition_count-a.proposition_count).slice(0,60)
    .map((d)=>({ concept:d.concept_label, attribute:d.attribute_label, propositions:d.proposition_count, concept_resolution:d.concept_resolution, attribute_resolution:d.attribute_resolution })),null,2));
  if (command === '--check') console.log('ID normalization OK:', JSON.stringify(summary));
}
