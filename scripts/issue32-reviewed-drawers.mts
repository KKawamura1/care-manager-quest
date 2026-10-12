import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

type Proposition = {
  classification_status?: string;
  primary_path?: readonly string[];
  year: number;
  question_number: number;
  choice_index: number;
  proposition_index: number;
  drawer_assignment?: ReviewDecision;
  [field: string]: unknown;
};
type ReviewDecision = {
  review_status: 'reviewed';
  proposition_id: string;
  source_fingerprint: string;
  concept_id: string;
  attribute_id: string;
  attribute_label: string;
  reason: string;
  [field: string]: unknown;
};
/** Fingerprint only the reviewed input, never the assignment or its history. */
export function drawerSourceFingerprint(row: Proposition) {
  const fields = ['question_stem', 'proposition', 'subject_concept', 'attribute', 'primary_path'];
  return createHash('sha256').update(JSON.stringify(fields.map(field => row[field] ?? null))).digest('hex');
}

/** The annual proposition (or its temporary revision) owns its review decision. */
export function validateDrawerAssignment(row: Proposition) {
  const decision = row.drawer_assignment;
  if (decision === undefined) return null;
  const id = row.year + '-' + String(row.question_number).padStart(2, '0') + '/c' + row.choice_index + '/p' + row.proposition_index;
  assert.ok(decision && typeof decision === 'object', 'invalid drawer decision: ' + id);
  assert.equal(row.classification_status, 'assigned', 'drawer review requires assigned classification: ' + id);
  assert.equal(decision.proposition_id, id, 'drawer review belongs to another proposition: ' + id);
  assert.equal(decision.review_status, 'reviewed', 'invalid drawer review status: ' + id);
  for (const field of ['concept_id', 'attribute_id', 'attribute_label', 'reason'] as const) {
    assert.ok(typeof decision[field] === 'string' && decision[field].trim(), 'drawer review ' + field + ' missing: ' + id);
  }
  assert.match(decision.concept_id, /^[1-4](?:\.[a-z0-9_]+)*$/, 'invalid reviewed concept ID: ' + id);
  assert.match(decision.attribute_id, /^[a-z][a-z0-9_]*$/, 'invalid reviewed attribute ID: ' + id);
  assert.equal(drawerSourceFingerprint(row), decision.source_fingerprint, 'stale drawer decision; review updated source: ' + id);
  assert.equal(decision.concept_id.split('.')[0], row.primary_path?.[0], 'drawer review must preserve source root: ' + id);
  return decision;
}

export function reviewedDrawerAssignment(row: Proposition, path: readonly string[]) {
  const decision = validateDrawerAssignment(row);
  if (JSON.stringify(path) !== JSON.stringify(row.primary_path)) return null;
  return decision;
}
