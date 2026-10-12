#!/usr/bin/env node
/**
 * Consolidate Issue #32 question revisions into the canonical annual JSONL files.
 * Usage: node scripts/consolidate-issue32-revisions.mjs [--check]
 *
 * - Merges question revisions for every covered year (2005..2025).
 * - Validates the complete effective dataset before any write.
 * - Rebuilds the manifest, difficult-case queue, and checksums.
 * - --check validates that the finished files represent the same effective data.
 * Idempotent: also rebuilds derived files when no revisions remain.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { dataDir, loadYear, validateYearRows } from './issue32-revisions.mjs';
import { sourceSyncSummary } from './issue32-sources.mjs';
import { buildIndex } from './normalize-issue32-ids.mjs';

const FIRST = 2005, LAST = 2025;
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
const overrideYears = [];
const revisionsRoot = jsonPath('revisions');
if (existsSync(revisionsRoot)) for (const entry of readdirSync(revisionsRoot, { withFileTypes: true })) {
  assert.ok(entry.isDirectory() && /^20\d{2}$/.test(entry.name) &&
    Number(entry.name) >= FIRST && Number(entry.name) <= LAST, 'unexpected revision entry: ' + entry.name);
}
for (let year = FIRST; year <= LAST; year++) {
  const path = jsonPath('revisions/' + year);
  const revisionFiles = existsSync(path) ? readdirSync(path) : [];
  if (checking) assert.equal(revisionFiles.length, 0, 'still has revisions: ' + year);
  const rows = loadYear(year);
  validateYearRows(year, rows);
  all.push({ year, rows });
  questionOverrides += revisionFiles.length;
  if (revisionFiles.length) overrideYears.push(year);
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
manifest.classification_quality_review.scope = '全年の分類レビュー履歴を年度正本へ統合。履歴件数は旧レビュー方式を含み、判定知識による個別意味レビューの件数とは別。正誤・当時法令の検証完了を意味しない。';
const oldOverlay = manifest.classification_review_overlay;
const batches = oldOverlay?.batches ?? (oldOverlay?.original_question_revisions ? [{
  years: oldOverlay.years, question_revisions: oldOverlay.original_question_revisions,
}] : []);
if (questionOverrides) batches.push({ years: overrideYears, question_revisions: questionOverrides });
manifest.classification_review_overlay = {
  state: 'consolidated',
  years: [FIRST, LAST],
  original_question_revisions: oldOverlay?.original_question_revisions ?? questionOverrides,
  consolidated_question_revisions: batches.reduce((count, batch) => count + batch.question_revisions, 0),
  remaining_question_revisions: 0,
  batches,
  note: '全年の設問別修正は年度JSONLへ反映済み。正本はpropositions/YYYY.jsonlだけ。',
};
const judgmentReviewed = all.flatMap(({ rows }) => rows).filter((row) =>
  row.knowledge_target_review?.principle === 'judgment_knowledge_over_context').length;
manifest.judgment_knowledge_review = {
  reviewed_records: judgmentReviewed, remaining_records: total - judgmentReviewed,
  scope: '判定に必要な知識を個別に記録した命題のみ集計。assignedや旧分類レビュー履歴からは認定しない。',
};
manifest.source_text_sync = sourceSyncSummary(all);
manifest.normalization_summary = buildIndex().summary;
const summaryBlock = [
  '<!-- issue32-summary:start -->',
  '## 移行前分類の監査集計',
  '',
  '`propositions/YYYY.jsonl`（2005〜2025年度）が唯一の分類正本です。設問別修正は全年度で統合し、`revisions/`には残していません。',
  '移行前の個別レビュー判断は `drawer_assignment` に保存します。このブランチの現行5×28分類は、同じ年度正本内の `taxonomy_assignment` が正本です。現在の所属・概念・属性・要確認件数は [再分類結果](./RECLASSIFICATION_5X28.md) を参照してください。以下は旧分類と既存レビューの保持を確認する監査集計です。',
  '',
  `- ${manifest.coverage.question_count.toLocaleString('en-US')}問・${manifest.coverage.choice_count.toLocaleString('en-US')}選択肢・${total.toLocaleString('en-US')}命題。assigned ${statusTotals.assigned.toLocaleString('en-US')}件、ambiguous ${statusTotals.ambiguous}件、unmapped ${statusTotals.unmapped}件。`,
  `- 判定知識の個別レビュー：${judgmentReviewed.toLocaleString('en-US')}命題。未レビュー：${(total - judgmentReviewed).toLocaleString('en-US')}命題。`,
  `- 旧方式を含む分類レビュー履歴：${reviewedTotal.toLocaleString('en-US')}命題。履歴の存在は意味・真偽・原文・法令の検証完了を意味しません。`,
  `- 移行前ID正規化：${manifest.normalization_summary.normalized_drawer_count.toLocaleString('en-US')}引き出し・${manifest.normalization_summary.concept_count}概念。要レビュー命題 ${manifest.normalization_summary.normalization_review_required_propositions.toLocaleString('en-US')}件、属性未整理 ${manifest.normalization_summary.unresolved_attribute_propositions.toLocaleString('en-US')}件、要レビュー引き出し ${manifest.normalization_summary.normalization_review_required_drawers}件（重複あり）。`,
  `- 原文同期：全1,260問・6,300選択肢をリポジトリ入力と照合。同期履歴は${manifest.source_text_sync.changed_questions}問・${manifest.source_text_sync.changed_choices}選択肢。PR39の校正を継承し、公式原本との二重校正は未完了として保持。`,
  '',
  '集計・難例一覧・文書・SHA-256は `node scripts/consolidate-issue32-revisions.mjs` で再生成します。CIは同スクリプトの `--check` と `node scripts/sync-issue32-sources.mjs --check` で、残存修正・集計・チェックサム・原文の同期漏れを検出します。',
  '',
  '分類実験と改善基盤のデータです。学習アプリで使う分類の確定には後続の意味レビューが必要です。以下のレビュー別セクションは当時の作業履歴で、現在の件数は本節とmanifestを優先します。',
  '<!-- issue32-summary:end -->',
].join('\n');
const readme = readFileSync(jsonPath('README.md'), 'utf8');
assert.match(readme, /<!-- issue32-summary:start -->[\s\S]*?<!-- issue32-summary:end -->/, 'README summary markers missing');
let expectedReadme = readme.replace(/<!-- issue32-summary:start -->[\s\S]*?<!-- issue32-summary:end -->/, summaryBlock);
const table = [
  '## 範囲と結果', '',
  '| 年度 | 問題 | 選択肢 | 命題記録 | assigned | ambiguous | unmapped | needs_source_review |',
  '|---:|---:|---:|---:|---:|---:|---:|---:|',
  ...yearly.map((item) => `| ${item.year} | 60 | 300 | ${item.proposition_record_count} | ${statuses.map((key) => item.status_counts[key]).join(' | ')} |`),
  '', `合計 **1,260問、6,300選択肢、${total.toLocaleString('en-US')}命題**。分割は${splitChoices}選択肢（追加${additional}件）。分類難例は${difficult.length}件です。`, '',
].join('\n');
expectedReadme = expectedReadme.replace(/## 範囲と結果\n[\s\S]*?(?=## 配置ルール)/, table + '\n');
if (!checking) {
  for (const { year, rows } of all) {
    atomicWrite('propositions/' + year + '.jsonl', jsonl(rows));
  }
  // Remove revisions only after all effective years passed validation and were written.
  for (let year = FIRST; year <= LAST; year++) {
    const dir = jsonPath('revisions/' + year);
    if (existsSync(dir)) rmSync(dir, { recursive: true });
  }
  atomicWrite('manifest.json', JSON.stringify(manifest, null, 2) + '\n');
  atomicWrite('difficult-cases.jsonl', difficult.length ? jsonl(difficult) : '');
  atomicWrite('README.md', expectedReadme);
  const paths = readdirSync(dataDir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name).slice(dataDir.length + 1))
    .filter((path) => path !== 'checksums.json').sort();
  const checksums = paths.map((path) => {
    const content = readFileSync(jsonPath(path));
    return { path, bytes: content.length, sha256: createHash('sha256').update(content).digest('hex') };
  });
  atomicWrite('checksums.json', JSON.stringify(checksums, null, 2) + '\n');
} else {
  const persisted = JSON.parse(readFileSync(jsonPath('manifest.json'), 'utf8'));
  assert.deepEqual(persisted.yearly_coverage, yearly, 'manifest year totals differ');
  assert.deepEqual(persisted.coverage, manifest.coverage, 'manifest coverage differs');
  assert.deepEqual(persisted.classification_quality_review, manifest.classification_quality_review, 'review history counts differ');
  assert.deepEqual(persisted.classification_review_overlay, manifest.classification_review_overlay, 'consolidation state differs');
  assert.deepEqual(persisted.judgment_knowledge_review, manifest.judgment_knowledge_review, 'judgment knowledge counts differ');
  assert.deepEqual(persisted.source_text_sync, manifest.source_text_sync, 'source synchronization metadata differs');
  assert.deepEqual(persisted.normalization_summary, manifest.normalization_summary, 'normalization counts differ');
  assert.equal(readme, expectedReadme, 'README summary or annual table differs');
  assert.deepEqual(persisted.coverage.status_counts, statusTotals, 'manifest status totals differ');
  assert.equal(persisted.coverage.proposition_record_count, total);
  assert.equal(persisted.coverage.difficult_case_count, difficult.length);
  const currentDifficult = readFileSync(jsonPath('difficult-cases.jsonl'), 'utf8').trim();
  assert.deepEqual(currentDifficult ? currentDifficult.split('\n').map(JSON.parse) : [], difficult);
  const checksums = JSON.parse(readFileSync(jsonPath('checksums.json'), 'utf8'));
  const actualPaths = readdirSync(dataDir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name).slice(dataDir.length + 1))
    .filter((path) => path !== 'checksums.json').sort();
  assert.deepEqual(checksums.map((item) => item.path), actualPaths, 'checksum inventory differs');
  for (const item of checksums) {
    const content = readFileSync(jsonPath(item.path));
    assert.equal(content.length, item.bytes, 'bytes changed ' + item.path);
    assert.equal(createHash('sha256').update(content).digest('hex'), item.sha256, 'digest changed ' + item.path);
  }
}
console.log((checking ? 'Verified' : 'Consolidated') + ': ' + questionOverrides + ' revisions, ' +
  total + ' propositions, ' + difficult.length + ' difficult, ' + reviewedTotal + ' reviewed.');
