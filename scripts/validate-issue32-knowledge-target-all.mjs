#!/usr/bin/env node
/**
 * End-to-end semantic-review integrity for knowledge-target-first Issue #32 decisions.
 * It validates all currently overlaid changes against the annual source snapshots.
 * Unlike a keyword heuristic, it never guesses classification nodes for unreviewed data.
 */
import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { dataDir, loadYear, validateYearRows } from './issue32-revisions.mjs';

const TAXONOMY = JSON.parse((await import('node:fs')).readFileSync(join(dataDir, 'taxonomy-v1.1.json'), 'utf8'));
const NODES = new Map(TAXONOMY.nodes.map((node) => [node.id, node]));
const identity = (row) => [row.question_id, row.choice_index, row.proposition_index].join('/');
const SOURCE_FIELDS = ['question_id', 'year', 'question_number', 'question_stem',
  'choice_index', 'proposition_index', 'source_text', 'proposition',
  'applicable_as_of', 'source_review_required'];
const requiredExamples = new Map([
  ['2005-15/2/2', '3.1.home_support'],
  ['2005-53/2/1', '2.3.assessment'],
  ['2007-29/5/1', '2.2'],
  ['2009-30/1/1', '1.2.lab'],
  ['2009-44/1/1', '3.1.preventive'],
  ['2009-44/4/1', '4.1.benefits'],
  ['2011-43/1/1', '3.1.facilities'],
  ['2012-40/5/1', '4.1.benefits.coordination'],
  ['2014-20/3/1', '3.1.preventive_support'],
  ['2015-34/5/1', '1.2'],
  ['2016-22/5/1', '3.1.facilities.tokuyo'],
  ['2023-31/3/1', '2.1'],
]);
let overlays = 0, modified = 0, reviewed = 0, resolved = 0, baselineAmbiguous = 0, actualAmbiguous = 0;
const observed = new Map();
for (let year = 2005; year <= 2025; year++) {
  const dir = join(dataDir, 'revisions', String(year));
  if (existsSync(dir)) overlays += readdirSync(dir).filter((name) => /^(0[1-9]|[1-5][0-9]|60)\.jsonl$/.test(name)).length;
  const beforeRows = loadYear(year, { baselineOnly: true });
  const afterRows = loadYear(year);
  validateYearRows(year, afterRows);
  const before = new Map(beforeRows.map((row) => [identity(row), row]));
  const after = new Map(afterRows.map((row) => [identity(row), row]));
  assert.equal(before.size, after.size, year + ': proposition counts or IDs changed');

  for (const [key, row] of after) {
    const old = before.get(key);
    assert.ok(old, 'unexpected proposition: ' + key);
    const changed = JSON.stringify(old) !== JSON.stringify(row);
    if (changed) {
      modified++;
      assert.equal(row.knowledge_target_review?.principle, 'judgment_knowledge_over_context', key + ': changed without target reasoning');
      for (const field of SOURCE_FIELDS) assert.deepEqual(row[field], old[field], key + ': changed source field ' + field);
      for (const field of Object.keys(old).filter((k) => k.startsWith('existing_'))) {
        assert.deepEqual(row[field], old[field], key + ': changed existing field ' + field);
      }
      // Re-reviewing an already corrected row retains the *immediate* predecessor
      // in knowledge_target_review.previous. The first appended review retains the
      // original annual snapshot, so use that for a baseline integrity assertion.
      const firstReview = row.classification_revision?.additional_reviews?.[0];
      assert.ok(firstReview, key + ': missing first audit trail');
      assert.equal(firstReview.previous_status, old.classification_status, key + ': lost original status');
      assert.deepEqual(firstReview.previous_primary_path, old.primary_path, key + ': lost original path');
      assert.equal(firstReview.previous_subject_concept, old.subject_concept, key + ': lost original subject');
      assert.equal(firstReview.previous_attribute, old.attribute, key + ': lost original attribute');
    }
    if (row.knowledge_target_review?.principle === 'judgment_knowledge_over_context') {
      reviewed++;
      const id = row.primary_node_id, node = NODES.get(id);
      assert.ok(node, key + ': missing canonical taxonomy node');
      assert.equal(row.classification_status, 'assigned', key + ': expected assigned');
      assert.equal(row.primary_path[0], id.split('.')[0], key + ': wrong root');
      assert.ok(row.primary_path.includes(node.label), key + ': missing node in full path');
      assert.ok(row.knowledge_target_review.needed_knowledge, key + ': no judgment knowledge');
      assert.ok(row.knowledge_target_review.context_not_decisive, key + ': no decoy context');
      assert.match(row.classification_reason, /^判定に必要な知識:/, key + ': no reason');
      assert.ok(row.classification_revision?.additional_reviews?.length, key + ': no audit history');
      if (row.knowledge_target_review.previous.status === 'ambiguous') resolved++;
    }
    if (old.classification_status === 'ambiguous') baselineAmbiguous++;
    if (row.classification_status === 'ambiguous') actualAmbiguous++;
    observed.set(key, row);
  }
}
for (const [id, node] of requiredExamples) {
  assert.equal(observed.get(id)?.primary_node_id, node, id + ': decisive knowledge regression');
}
assert.ok(reviewed >= 225, 'Expected at least 225 reviewed propositions, got ' + reviewed);
assert.ok(resolved >= 25, 'Expected at least 25 documented ambiguity resolutions, got ' + resolved);
if (overlays > 0) {
  assert.ok(overlays >= 77, 'Expected at least 77 separate question revision files');
  assert.ok(modified >= 225, 'Expected at least 225 actual proposition changes, got ' + modified);
  assert.equal(baselineAmbiguous - actualAmbiguous, 25, 'unexpected net ambiguous change');
}
console.log('Knowledge-target audit OK: ' + reviewed + ' reviewed propositions, ' + modified +
  ' overlay modifications, ' + overlays + ' question revisions, ' + resolved +
  ' resolved prior ambiguities; ' + actualAmbiguous + ' remaining ambiguous.');
