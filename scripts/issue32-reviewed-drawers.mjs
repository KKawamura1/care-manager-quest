import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const entries = readFileSync(new URL('../docs/taxonomy/issue-32-experiment/reviewed-drawer-assignments.jsonl', import.meta.url), 'utf8')
  .trim().split(/\r?\n/).map(line => JSON.parse(line));
const decisions = new Map(entries.map(entry => [entry.proposition_id, entry]));
assert.equal(decisions.size, entries.length, 'duplicate reviewed drawer decision');

export function reviewedDrawerAssignment(row, path) {
  if (row.classification_status !== 'assigned' || JSON.stringify(path) !== JSON.stringify(row.primary_path)) return null;
  const id = row.year + '-' + String(row.question_number).padStart(2, '0') + '/c' + row.choice_index + '/p' + row.proposition_index;
  const decision = decisions.get(id);
  if (!decision) return null;
  const fields = ['question_stem', 'proposition', 'subject_concept', 'attribute', 'primary_path'];
  const fingerprint = createHash('sha256').update(JSON.stringify(fields.map(field => row[field] ?? null))).digest('hex');
  assert.equal(fingerprint, decision.source_fingerprint, 'stale drawer decision; review updated source: ' + id);
  assert.equal(decision.concept_id.split('.')[0], path[0], 'drawer review must preserve source root: ' + id);
  assert.ok(decision.reason, 'review reason missing: ' + id);
  return decision;
}
