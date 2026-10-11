/**
 * Editable Issue #32 review data: canonical annual files plus temporary question revisions.
 * Consolidation folds pending revisions into the annual files and rebuilds derived metadata.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateDrawerAssignment } from './issue32-reviewed-drawers.mts';

export const dataDir = join(dirname(dirname(fileURLToPath(import.meta.url))), 'docs/taxonomy/issue-32-experiment');
export const FIRST_YEAR = 2005;
export const LAST_YEAR = 2025;
const ROOTS = { '1': '人の健康と生活', '2': '支援の考え方と方法', '3': '支援の提供体制', '4': '社会保障の仕組み' };
const STATUSES = ['assigned', 'ambiguous', 'unmapped', 'needs_source_review'];

export const questionFilename = (number) => String(number).padStart(2, '0') + '.jsonl';
export const revisionPath = (year, number) => join(dataDir, 'revisions', String(year), questionFilename(number));

export function readJsonl(path) {
  const content = readFileSync(path, 'utf8').trim();
  assert.ok(content, 'empty JSONL: ' + path);
  return content.split(/\r?\n/).map((line, index) => {
    try { return JSON.parse(line); }
    catch (error) { throw new Error(path + ':' + (index + 1) + ': ' + error.message); }
  });
}

function groupByQuestion(rows) {
  const result = new Map();
  for (const row of rows) {
    const number = row.question_number;
    assert.ok(Number.isInteger(number) && number >= 1 && number <= 60, 'invalid question number: ' + number);
    if (!result.has(number)) result.set(number, []);
    result.get(number).push(row);
  }
  return result;
}

function validateRecord(row, year) {
  validateDrawerAssignment(row);
  const key = [row.question_id, row.choice_index, row.proposition_index].join('/');
  assert.equal(row.year, year, 'wrong year ' + key);
  assert.ok(typeof row.question_id === 'string' && row.question_id, key);
  assert.ok(typeof row.question_stem === 'string' && row.question_stem, key);
  assert.ok(typeof row.source_text === 'string' && row.source_text, key);
  assert.ok(typeof row.proposition === 'string' && row.proposition, key);
  assert.ok(Number.isInteger(row.choice_index) && row.choice_index >= 1 && row.choice_index <= 5, key);
  assert.ok(Number.isInteger(row.proposition_index) && row.proposition_index >= 1, key);
  assert.ok(STATUSES.includes(row.classification_status), key);
  assert.ok(Array.isArray(row.primary_path), key);
  if (row.classification_status === 'assigned') {
    assert.ok(row.primary_path.length >= 2 && ROOTS[row.primary_path[0]] === row.primary_path[1], 'invalid root: ' + key);
    const legacyGap = key === '2024-24/2/1' && row.subject_concept === '通報義務' && row.attribute === '';
    assert.ok(row.subject_concept && row.classification_reason && (row.attribute || legacyGap), key);
  } else {
    assert.equal(row.primary_path.length, 0, 'non-assigned path: ' + key);
    if (row.classification_status === 'ambiguous') {
      assert.ok(Array.isArray(row.candidate_paths) && row.candidate_paths.length >= 2, 'too few candidates: ' + key);
      const paths = row.candidate_paths.map((p) => {
        assert.ok(Array.isArray(p) && ROOTS[p[0]] === p[1], 'invalid candidate root: ' + key);
        return JSON.stringify(p);
      });
      assert.equal(new Set(paths).size, paths.length, 'duplicate candidate: ' + key);
    }
  }
}

export function validateYearRows(year, rows) {
  const byQuestion = groupByQuestion(rows);
  assert.equal(byQuestion.size, 60, String(year) + ': expected 60 questions');
  const keys = new Set();
  for (const [number, question] of byQuestion) {
    const choiceIndices = new Map();
    const questionId = question[0].question_id;
    const stem = question[0].question_stem;
    for (const row of question) {
      validateRecord(row, year);
      assert.equal(row.question_number, number);
      assert.equal(row.question_id, questionId, 'mixed question IDs: ' + year + '/' + number);
      assert.equal(row.question_stem, stem, 'mixed question stems: ' + year + '/' + number);
      const key = [row.question_id, row.choice_index, row.proposition_index].join('/');
      assert.ok(!keys.has(key), 'duplicate proposition ' + key);
      keys.add(key);
      if (!choiceIndices.has(row.choice_index)) choiceIndices.set(row.choice_index, []);
      choiceIndices.get(row.choice_index).push(row.proposition_index);
    }
    assert.equal(choiceIndices.size, 5, year + '/' + number + ': expected 5 choices');
    for (const [choice, indices] of choiceIndices) {
      indices.sort((a, b) => a - b);
      assert.deepEqual(indices, Array.from({ length: indices.length }, (_, i) => i + 1), year + '/' + number + '/' + choice);
    }
  }
}

function verifyRevision(year, number, original, changed) {
  assert.ok(changed.length >= 5, year + '/' + number + ': empty or incomplete revision');
  const first = original[0];
  // The original may contain several independent propositions per choice.
  // Compare matching proposition metadata instead of accidentally using the last
  // proposition in the choice as the baseline for every other proposition.
  const originalByProposition = new Map(original.map((r) =>
    [r.choice_index + '/' + r.proposition_index, r]));
  const originalByChoice = new Map();
  for (const row of original) {
    if (!originalByChoice.has(row.choice_index)) originalByChoice.set(row.choice_index, row);
  }
  for (const row of changed) {
    assert.ok(!(row.question_id === '2024-24' && row.choice_index === 2 && row.proposition_index === 1 && !row.attribute),
      '2024-24/2/1 must fix the known blank attribute when this question is revised');
    const old = originalByProposition.get(row.choice_index + '/' + row.proposition_index)
      ?? originalByChoice.get(row.choice_index);
    assert.ok(old, 'new choice index: ' + year + '/' + number + '/' + row.choice_index);
    assert.equal(row.year, year, 'year changed');
    assert.equal(row.question_number, number, 'question number changed');
    assert.equal(row.question_id, first.question_id, 'question ID changed');
    assert.equal(row.question_stem, old.question_stem, 'question stem changed');
    assert.equal(row.source_text, old.source_text, 'choice source text changed');
    // Preserve independently curated source and scoring metadata across a classification-only review.
    for (const key of Object.keys(old)) {
      if (key.startsWith('existing_') || key === 'applicable_as_of' || key === 'source_review_required') {
        assert.deepEqual(row[key], old[key], 'source metadata changed: ' + year + '/' + number + '/' + key);
      }
    }
  }
}

export function loadYear(year, options = {}) {
  assert.ok(Number.isInteger(year) && year >= FIRST_YEAR && year <= LAST_YEAR, 'unsupported year: ' + year);
  const baseline = readJsonl(join(dataDir, 'propositions', year + '.jsonl'));
  const original = groupByQuestion(baseline);
  if (options.baselineOnly) return baseline;
  const revisionsDir = join(dataDir, 'revisions', String(year));
  if (!existsSync(revisionsDir)) return baseline;
  const edits = new Map();
  for (const filename of readdirSync(revisionsDir).sort()) {
    assert.match(filename, /^(0[1-9]|[1-5][0-9]|60)\.jsonl$/, 'unexpected revision file ' + filename);
    const number = Number(filename.slice(0, 2));
    const old = original.get(number);
    assert.ok(old, 'revision for missing question: ' + year + '/' + number);
    const changed = readJsonl(join(revisionsDir, filename));
    verifyRevision(year, number, old, changed);
    edits.set(number, changed);
  }
  const output = [];
  for (const [number, originalRows] of original) {
    const rows = edits.get(number) || originalRows;
    output.push(...rows);
  }
  return output;
}

export function collectSummary() {
  const yearlyCoverage = [];
  const difficultCases = [];
  let total = 0;
  let choiceCount = 0;
  const totals = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  for (let year = FIRST_YEAR; year <= LAST_YEAR; year++) {
    const rows = loadYear(year);
    validateYearRows(year, rows);
    const status = Object.fromEntries(STATUSES.map((s) => [s, 0]));
    const distinctChoices = new Set();
    for (const row of rows) {
      status[row.classification_status]++;
      distinctChoices.add(row.question_id + '/' + row.choice_index);
      if (row.classification_status === 'ambiguous' || row.classification_status === 'unmapped') difficultCases.push(row);
    }
    assert.equal(distinctChoices.size, 300, year + ': expected 300 choices');
    for (const s of STATUSES) totals[s] += status[s];
    total += rows.length;
    choiceCount += distinctChoices.size;
    yearlyCoverage.push({ year, question_count: 60, choice_count: 300, proposition_record_count: rows.length, status_counts: status });
  }
  return {
    summary: { question_count: yearlyCoverage.length * 60, choice_count: choiceCount, proposition_record_count: total,
      difficult_case_count: difficultCases.length, status_counts: totals, yearly_coverage: yearlyCoverage },
    difficultCases
  };
}
