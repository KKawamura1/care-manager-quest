#!/usr/bin/env node
/**
 * Consolidate Issue #32 question revisions into the canonical annual JSONL files.
 * Usage: node scripts/consolidate-issue32-revisions.mjs [--check]
 *
 * - Merges ONLY 2005..2018, leaving 2019..2025 unchanged.
 * - Validates the complete effective dataset before any write.
 * - Rebuilds the manifest, difficult-case queue, and checksums.
 * - --check validates that the finished files represent the same effective data.
 * Idempotent: no revision files means no changes in the annual JSONL.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, mkdirSync, rmSync, writeFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { dataDir, loadYear, validateYearRows } from './issue32-revisions.mjs';

const FIRST = 2005, LAST = 2025, CONSOLIDATE_TO = 2018;
const checking = process.argv.includes('--check');
assert.ok(process.argv.slice(2).every((arg) => arg === '--check'), 'usage: consolidate-issue32-revisions.mjs [--check]');
const jsonl = (rows) => rows.map((r) => JSON.stringify(r)).join('\n') + '\n';
const roots = ['人の健康と生活', '支援の考え方と方法', '支援の提供体制', '社会保障の仕組み'];
const statuses = ['assigned', 'ambiguous', 'unmapped', 'needs_source_review'];
const countStatuses = () => Object.fromEntries(statuses.map((status) => [status, 0]));
const countRoots = () => Object.fromEntries(roots.map((root) => [root, 0]));
const jsonPath = (path) => join(dataDir, path);
const atomicWrite = (path, content) => {
  const destination = jsonPath(path);
  const temporary = destination + '.consolidation-tmp';
  writeFileSync(temporary, content, 'utf8');
  renameSync(temporary, destination);
};
const all = [];
let questionOverrides = 0;
for (let year = FIRST; year <= LAST; year++) {
  const path = jsonPath('revisions/' + year);
  const revisionFiles = existsSync(path) ? readdirSync(path) : [];
  if (year > CONSOLIDATE_TO) assert.equal(revisionFiles.length, 0, 'unexpected later-year revisions: ' + year);
  if (checking && year <= CONSOLIDATE_TO) assert.equal(revisionFiles.length, 0, 'still has revisions: ' + year);
  const rows = loadYear(year);
  validateYearRows(year, rows);
  all.push({ year, rows });
  if (year <= CONSOLIDATE_TO) questionOverrides += revisionFiles.length;
}
const yearly = [], difficult = [], reviewYears = {};
const statusTotals = countStatuses(), rootTotals = countRoots();
let splitChoices = 0, additional = 0;
for (const { year, rows } of all) {
  const status = countStatuses(), rootCounts = countRoots(), candidateCounts = {};
  const perChoice = new Map();
  let reviewed = 0;
  for (const r of rows) {
    status[r.classification_status]++;
    if (r.classification_status === 'assigned') rootCounts[r.primary_path[1]]++;
    if (r.classification_status === 'ambiguous') for (const path of r.candidate_paths) {
      candidateCounts[path[1]] = (candidateCounts[path[1]] ?? 0) + 1;
    }
    if (['ambiguous','unmapped'].includes(r.classification_status)) difficult.push(r);
    const choiceKey = r.question_id + '/' + r.choice_index;
    perChoice.set(choiceKey, (perChoice.get(choiceKey) ?? 0) + 1);
    if (r.classification_revision || r.classification_review?.version === 'taxonomy-v1.1') reviewed++;
  }
  assert.equal(perChoice.size, 300, year + ': 300 choices required');
  for (const count of perChoice.values()) if (count > 1) { splitChoices++; additional += count - 1; }
  if (reviewed) reviewYears[year] = reviewed;
  for (const key of statuses) statusTotals[key] += status[key];
  for (const key of roots) rootTotals[key] += rootCounts[key];
  yearly.push({
    year, question_count: 60, choice_count: 300,
    proposition_record_count: rows.length, status_counts: status,
    primary_root_counts: rootCounts, ambiguous_candidate_root_counts: candidateCounts,
  });
}
const total = yearly.reduce((n, x) => n + x.proposition_record_count, 0);
if (!checking && questionOverrides === 0) { console.log('Already consolidated: no revision files'); process.exit(0); }
const reviewedTotal = Object.values(reviewYears).reduce((a, b) => a + b, 0);
const manifest = JSON.parse(readFileSync(jsonPath('manifest.json'), 'utf8'));
manifest.yearly_coverage = yearly;
Object.assign(manifest.coverage, {
  question_count: 1260,
  choice_count: 6300,
  proposition_record_count: total,
  choices_split_into_multiple_propositions: splitChoices,
  additional_proposition_records_from_splits: additional,
  difficult_case_count: difficult.length,
  status_counts: statusTotals,
  primary_root_counts: rootTotals,
});
manifest.classification_quality_review.reviewed_years = reviewYears;
manifest.classification_quality_review.reviewed_records = reviewedTotal;
manifest.classification_quality_review.remaining_without_semantic_review = total - reviewedTotal;
manifest.classification_quality_review.scope = '2005–2018年度の設問単位レビューを年度正本に統合。過去のレビュー履歴・出典確認フラグは保持。正誤・OCR・当時法令の検証は含まない。';
manifest.classification_review_overlay = {
  state: 'consolidated',
  years: [2005, 2018],
  original_question_revisions: questionOverrides,
  note: '2005–2018年度の設問別修正は年度JSONLへ反映済み。重複したrevisionファイルは削除。',
};
if (!checking) {
  for (const { year, rows } of all) if (year <= CONSOLIDATE_TO) {
    atomicWrite('propositions/' + year + '.jsonl', jsonl(rows));
  }
  // Remove revisions only after all effective years passed validation and were written.
  for (let year = FIRST; year <= CONSOLIDATE_TO; year++) {
    const dir = jsonPath('revisions/' + year);
    if (existsSync(dir)) rmSync(dir, { recursive: true });
  }
  atomicWrite('manifest.json', JSON.stringify(manifest, null, 2) + '\n');
  atomicWrite('difficult-cases.jsonl', difficult.length ? jsonl(difficult) : '');
  const paths = JSON.parse(readFileSync(jsonPath('checksums.json'), 'utf8'))
    .map(({ path }) => path)
    .filter((path) => path !== 'README.md');
  const checksums = paths.map((path) => {
    const content = readFileSync(jsonPath(path));
    return { path, bytes: content.length, sha256: createHash('sha256').update(content).digest('hex') };
  });
  atomicWrite('checksums.json', JSON.stringify(checksums, null, 2) + '\n');
} else {
  const persisted = JSON.parse(readFileSync(jsonPath('manifest.json'), 'utf8'));
  assert.deepEqual(persisted.yearly_coverage, yearly, 'manifest year totals differ');
  assert.deepEqual(persisted.coverage.status_counts, statusTotals, 'manifest status totals differ');
  assert.equal(persisted.coverage.proposition_record_count, total);
  assert.equal(persisted.coverage.difficult_case_count, difficult.length);
  const currentDifficult = readFileSync(jsonPath('difficult-cases.jsonl'), 'utf8').trim();
  assert.deepEqual(currentDifficult ? currentDifficult.split('\n').map(JSON.parse) : [], difficult);
  for (const item of JSON.parse(readFileSync(jsonPath('checksums.json'), 'utf8'))) {
    const content = readFileSync(jsonPath(item.path));
    assert.equal(content.length, item.bytes, 'bytes changed ' + item.path);
    assert.equal(createHash('sha256').update(content).digest('hex'), item.sha256, 'digest changed ' + item.path);
  }
}
console.log((checking ? 'Verified' : 'Consolidated') + ': ' + questionOverrides + ' revisions, ' +
  total + ' propositions, ' + difficult.length + ' difficult, ' + reviewedTotal + ' reviewed.');
