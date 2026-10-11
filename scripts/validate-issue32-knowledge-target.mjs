#!/usr/bin/env node
/**
 * Regression cases for Issue #32's "judgment knowledge over prompt context" rule.
 * Does not adjudicate answer truth or historical law.
 *
 * Runs against the effective question-level revision overlay, then keeps working
 * if the overlay is consolidated into the annual files later.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { dataDir, loadYear, revisionPath } from './issue32-revisions.mjs';

const EXPECTED = {
  '2005-37': { 1: '3.1.home.visiting_nurse' },
  '2005-53': { 1: '2.1', 2: '2.3.assessment', 3: '1.1.dementia', 4: '1.1.dementia', 5: '1.1.dementia' },
  '2005-57': { 1: '2.3.resources', 3: '2.3.resources', 4: '2.3.resources', 5: '2.3.resources' },
  '2006-37': { 1: '3.1.preventive' },
  '2007-08': { 4: '3.1.home_support' },
  '2007-14': { 5: '3.4.community_center' },
  '2007-29': { 5: '2.2' },
  '2007-49': { 1: '2.4', 2: '2.4', 3: '2.4', 4: '2.3.resources', 5: '2.3.resources' },
  '2014-20': { 1: '3.1.preventive_support', 2: '3.1.preventive_support', 3: '3.1.preventive_support', 4: '3.1.preventive_support', 5: '3.1.preventive_support' },
};

const taxonomy = JSON.parse(readFileSync(join(dataDir, 'taxonomy-v1.1.json'), 'utf8'));
const nodes = new Map(taxonomy.nodes.map((node) => [node.id, node]));
const byYear = new Map();
const unchangedMetadataKeys = (row) => Object.keys(row)
  .filter((key) => key.startsWith('existing_') || key === 'source_review_required' || key === 'applicable_as_of');

let checked = 0;
let resolved = 0;
let overlays = 0;
for (const [questionId, expectedChoices] of Object.entries(EXPECTED)) {
  const [year, questionNumber] = questionId.split('-').map(Number);
  if (!byYear.has(year)) byYear.set(year, {
    original: loadYear(year, { baselineOnly: true }),
    effective: loadYear(year),
  });
  const yearRows = byYear.get(year);
  const original = yearRows.original.filter((r) => r.question_number === questionNumber);
  const effective = yearRows.effective.filter((r) => r.question_number === questionNumber);
  const key = (r) => r.choice_index + '/' + r.proposition_index;
  const origByKey = new Map(original.map((row) => [key(row), row]));
  const changedByKey = new Map(effective.map((row) => [key(row), row]));
  assert.equal(original.length, effective.length, questionId + ': proposition count changed');
  assert.equal(new Set(original.map((r) => r.choice_index)).size, 5, questionId + ': missing choices');

  const hasOverlay = existsSync(revisionPath(year, questionNumber));
  if (hasOverlay) overlays++;
  for (const [choiceText, nodeId] of Object.entries(expectedChoices)) {
    const choiceIndex = Number(choiceText);
    const id = choiceIndex + '/1';
    const before = origByKey.get(id);
    const after = changedByKey.get(id);
    const node = nodes.get(nodeId);
    assert.ok(before && after && node, questionId + '/' + id + ': missing item/node');
    assert.equal(after.classification_status, 'assigned', questionId + '/' + id);
    assert.equal(after.primary_node_id, nodeId, questionId + '/' + id + ': incorrect knowledge node');
    assert.equal(after.primary_path[0], nodeId.split('.')[0], questionId + '/' + id + ': wrong root');
    assert.ok(after.primary_path.includes(node.label), questionId + '/' + id + ': path omits node label');
    assert.equal(after.taxonomy_version, 'hypothesis-v1.1');
    assert.match(after.classification_reason, /^判定に必要な知識:/);
    assert.equal(after.knowledge_target_review?.principle, 'judgment_knowledge_over_context');
    assert.ok(after.knowledge_target_review?.needed_knowledge, 'missing decisive knowledge');
    assert.ok(after.knowledge_target_review?.context_not_decisive, 'missing context contrast');
    assert.ok(after.classification_revision?.additional_reviews?.length, 'missing appended review history');

    assert.equal(after.question_stem, before.question_stem);
    assert.equal(after.source_text, before.source_text);
    assert.equal(after.proposition, before.proposition);
    for (const field of unchangedMetadataKeys(before)) {
      assert.deepEqual(after[field], before[field], questionId + '/' + id + ': modified ' + field);
    }
    if (hasOverlay) {
      assert.deepEqual(after.knowledge_target_review.previous.primary_path, before.primary_path);
      assert.equal(after.knowledge_target_review.previous.subject_concept, before.subject_concept);
      assert.equal(after.knowledge_target_review.previous.attribute, before.attribute);
      if (before.classification_status === 'ambiguous') resolved++;
    }
    checked++;
  }

  // Only the named choices may be modified in each new question overlay.
  if (hasOverlay) {
    for (const row of effective) {
      if (row.proposition_index === 1 && Object.hasOwn(expectedChoices, row.choice_index)) continue;
      assert.deepEqual(row, origByKey.get(key(row)), questionId + '/' + key(row) + ': unrelated row modified');
    }
  }
}
assert.equal(checked, 24, 'expected exactly 24 regression cases');
if (overlays > 0) {
  assert.equal(overlays, 9, 'expected all nine question overlays before consolidation');
  assert.equal(resolved, 8, 'expected eight genuinely resolved ambiguous cases');
}
console.log('Knowledge-target regression OK: ' + checked + ' cases; ' +
  overlays + ' question overlays; ' + resolved + ' previous ambiguous decisions.');
