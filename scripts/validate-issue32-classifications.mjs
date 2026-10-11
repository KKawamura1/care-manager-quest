/**
 * Issue #32 taxonomy experiment integrity checks.
 * Run: node scripts/validate-issue32-classifications.mjs
 * Classification correctness is NOT established by this script. The tests
 * only validate references, derived summaries, traceability and known regressions.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dir = join(root, 'docs/taxonomy/issue-32-experiment');
const read = (path) => readFileSync(join(dir, path), 'utf8');
const json = (path) => JSON.parse(read(path));
const jsonl = (path) => read(path).trim().split('\n').filter(Boolean).map((line) => JSON.parse(line));
const manifest = json('manifest.json');
const difficult = jsonl('difficult-cases.jsonl');
const checksumList = json('checksums.json');
const roots = { '1': '人の健康と生活', '2': '支援の考え方と方法', '3': '支援の提供体制', '4': '社会保障の仕組み' };

let total = 0;
const allDifficult = new Set();
const reviewed = {};
const lookup = new Map();
const statusTotal = { assigned: 0, ambiguous: 0, unmapped: 0, needs_source_review: 0 };
const rootTotal = Object.fromEntries(Object.values(roots).map((label) => [label, 0]));

for (let year = 2005; year <= 2025; year++) {
  const rows = jsonl(`propositions/${year}.jsonl`);
  const byQuestion = new Map();
  const identities = new Set();
  const perChoice = new Map();
  const status = { assigned: 0, ambiguous: 0, unmapped: 0, needs_source_review: 0 };
  const rootCounts = Object.fromEntries(Object.values(roots).map((label) => [label, 0]));
  const candidates = {};
  for (const row of rows) {
    assert.equal(row.year, year);
    assert.ok(row.question_id && row.source_text && row.proposition && row.question_stem);
    assert.ok(row.choice_index >= 1 && row.choice_index <= 5);
    assert.ok(row.proposition_index >= 1);
    const key = [row.question_id, row.choice_index, row.proposition_index].join('/');
    assert.ok(!identities.has(key), `duplicate proposition: ${key}`);
    identities.add(key);
    lookup.set(key, row);
    byQuestion.set(row.question_id, (byQuestion.get(row.question_id) ?? new Set()).add(row.choice_index));
    const choiceKey = [row.question_id, row.choice_index].join('/');
    (perChoice.get(choiceKey) ?? perChoice.set(choiceKey, []).get(choiceKey)).push(row.proposition_index);
    assert.ok(Object.hasOwn(status, row.classification_status), key);
    status[row.classification_status]++;
    if (row.classification_status === 'assigned') {
      assert.equal(row.primary_path[0], Object.keys(roots).find((id) => roots[id] === row.primary_path[1]), key);
      // Known pre-existing PR #33 debt: 2024-24/2/1 has an empty attribute.
      // Keep the snapshot immutable; a question revision must fix this rather than hide new omissions.
      const knownIncomplete = key === '2024-24/2/1' && row.subject_concept === '通報義務' && row.attribute === '';
      assert.ok(row.subject_concept && row.classification_reason && (row.attribute || knownIncomplete), key);
      rootCounts[row.primary_path[1]]++;
    } else {
      assert.equal(row.primary_path.length, 0, key);
      if (row.classification_status === 'ambiguous') {
        assert.ok(row.candidate_paths.length >= 2, key);
        for (const path of row.candidate_paths) {
          assert.equal(path[1], roots[path[0]], key);
          candidates[path[1]] = (candidates[path[1]] || 0) + 1;
        }
      }
      if (['ambiguous', 'unmapped'].includes(row.classification_status)) allDifficult.add(key);
    }
    if (row.classification_revision) {
      reviewed[year] = (reviewed[year] || 0) + 1;
      // Older review batches store the previous values under `previous`; later
      // batches use `previous_status` / `previous_primary_path` directly.
      const revision = row.classification_revision;
      assert.ok(typeof revision === 'object' && Object.keys(revision).length > 0, `empty revision history: ${key}`);
      if (revision.previous_primary_path !== undefined) assert.ok(Array.isArray(revision.previous_primary_path), key);
      if (revision.previous !== undefined) assert.ok(typeof revision.previous === 'object' && revision.previous !== null, key);
    } else if (row.classification_review?.version === 'taxonomy-v1.1') {
      // Newly created propositions from a reviewed split have no previous path
      // to store in classification_revision, but are still reviewed.
      reviewed[year] = (reviewed[year] || 0) + 1;
    }
  }
  assert.equal(byQuestion.size, 60, `questions in ${year}`);
  assert.equal(perChoice.size, 300, `choices in ${year}`);
  for (const [id, set] of byQuestion) assert.equal(set.size, 5, `choices in ${id}`);
  for (const [id, indices] of perChoice) {
    indices.sort((a, b) => a - b);
    assert.deepEqual(indices, Array.from({ length: indices.length }, (_, i) => i + 1), `indices ${id}`);
  }
  const expected = manifest.yearly_coverage.find((item) => item.year === year);
  assert.ok(expected, year);
  assert.equal(expected.proposition_record_count, rows.length);
  assert.deepEqual(expected.status_counts, status, `status in ${year}`);
  assert.deepEqual(expected.primary_root_counts, rootCounts, `root in ${year}`);
  assert.deepEqual(expected.ambiguous_candidate_root_counts, candidates, `candidates in ${year}`);
  for (const key in statusTotal) statusTotal[key] += status[key];
  for (const key in rootTotal) rootTotal[key] += rootCounts[key];
  total += rows.length;
}

const difficultKeys = difficult.map((r) => [r.question_id, r.choice_index, r.proposition_index].join('/'));
assert.equal(new Set(difficultKeys).size, difficultKeys.length, 'duplicate difficult case');
assert.deepEqual(new Set(difficultKeys), allDifficult, 'difficult-cases out of sync');
assert.equal(total, manifest.coverage.proposition_record_count);
assert.equal(manifest.coverage.proposition_record_count, total);
assert.equal(manifest.coverage.difficult_case_count, difficult.length);
assert.deepEqual(manifest.coverage.status_counts, statusTotal);
assert.deepEqual(manifest.coverage.primary_root_counts, rootTotal);
assert.deepEqual(reviewed, manifest.classification_quality_review.reviewed_years, 'reviewed record counts');
assert.equal(manifest.classification_quality_review.reviewed_records, Object.values(reviewed).reduce((a, b) => a + b, 0));
assert.equal(manifest.classification_quality_review.remaining_without_semantic_review, total - manifest.classification_quality_review.reviewed_records);

const expectedPaths = [
  ['2018-10/5/1', '普通徴収と特別徴収'],
  ['2018-21/1/1', '認定調査票'],
  ['2019-04/1/1', '特定疾病'],
  ['2019-09/2/1', '第1号被保険者保険料'],
  ['2019-12/3/1', '包括的支援事業'],
  ['2019-21/1/1', '申請代行'],
  ['2019-24/4/1', '住環境の調整'],
  ['2019-48/2/1', '個別援助'],
  ['2019-54/3/1', '居宅介護住宅改修費'],
  ['2021-03/1/2', '受給権保障'],
  ['2021-09/2/1', '指定権者'],
  ['2021-22/3/1', '施設サービス計画'],
  ['2021-31/2/1', '認知症疾患医療センター'],
  ['2021-34/4/1', '褥瘡'],
  ['2021-41/4/1', '訪問看護'],
  ['2021-43/2/1', '看護小規模多機能型居宅介護'],
  ['2021-54/3/1', '居宅介護住宅改修費'],
  ['2022-07/1/1', '介護老人福祉施設（特養）'],
  ['2022-10/3/1', '普通徴収'],
  ['2022-12/3/1', '包括的支援事業'],
  ['2022-38/4/1', '頭部外傷'],
  ['2022-54/4/1', '特定福祉用具販売'],
  ['2024-13/1/1', '認知症総合支援事業'],
  ['2024-31/1/1', '退院・退所支援'],
  ['2025-02/5/1', '認知症基本法'],
  ['2025-27/3/1', '膀胱留置カテーテル'],
  ['2025-44/1/1', '看護小規模多機能型居宅介護'],
  ['2025-51/1/1', '基本方針'],
  ['care_manager_2020_001/1/1', '要介護・要支援認定者数'],
  ['care_manager_2020_007/1/1', '高額介護サービス費'],
  ['care_manager_2020_020/3/1', '居宅介護支援'],
  ['care_manager_2020_025/5/1', 'ヤングケアラー'],
  ['care_manager_2020_034/1/1', '認知症初期集中支援チーム'],
  ['care_manager_2020_052/3/1', '居宅介護支援'],
];
for (const [id, segment] of expectedPaths) {
  const row = lookup.get(id);
  assert.ok(row, `missing regression fixture: ${id}`);
  assert.ok(row.primary_path.join(' > ').includes(segment), `misclassified ${id}: ${row.primary_path.join(' > ')}`);
}


const assert2025 = (id) => {
  const record = lookup.get(id);
  assert.ok(record, `missing 2025 review fixture: ${id}`);
  return record;
};
assert.match(assert2025('2025-12/1/1').proposition, /一般介護予防事業に含まれる/);
assert.match(assert2025('2025-13/2/1').proposition, /公表項目に含まれる/);
assert.match(assert2025('2025-15/3/1').proposition, /国民健康保険団体連合会の業務に含まれる/);
assert.match(assert2025('2025-19/4/1').proposition, /課題分析標準項目に含まれる/);
assert.match(assert2025('2025-22/5/1').proposition, /基本チェックリストの質問項目に含まれる/);
assert.match(assert2025('2025-39/1/1').proposition, /臨死期の徴候である/);
assert.equal(assert2025('2025-39/1/1').primary_path[0], '1');
assert.equal(assert2025('2025-30/3/1').primary_path[0], '2');
assert.ok(assert2025('2025-41/5/1').primary_path.includes('看護師'));
assert.ok(assert2025('2025-52/3/1').primary_path.includes('提供内容'));
for (const [question, choice] of [['2025-27', 1], ['2025-47', 1]]) {
  const a = assert2025(`${question}/${choice}/1`);
  const b = assert2025(`${question}/${choice}/2`);
  assert.equal(a.source_text, b.source_text, `split source changed: ${question}`);
  assert.notEqual(a.proposition, b.proposition, `split propositions are identical: ${question}`);
  assert.ok(b.proposition_revision, `split revision missing: ${question}`);
}


// Consolidated 2020–2024 review regression tests.
assert.equal(manifest.year_2020_review.resolved_ambiguous, 6);
assert.equal(manifest.yearly_coverage.find((x) => x.year === 2020).status_counts.ambiguous, 0);
for (const p of [1, 2]) {
  const row = lookup.get(`2021-03/1/${p}`);
  assert.ok(row && row.source_review_required, '2021 social-insurance split lost');
}
assert.equal(lookup.get('2021-03/1/1').source_text, lookup.get('2021-03/1/2').source_text);
assert.notEqual(lookup.get('2021-03/1/1').proposition, lookup.get('2021-03/1/2').proposition);

for (const [question, choice, term] of [[12, 3, '包括的支援事業'], [13, 1, '国民健康保険団体連合会'], [16, 4, '主治医意見書'], [17, 1, '特定疾病']]) {
  const key = `2022-${String(question).padStart(2, '0')}/${choice}/1`;
  const row = lookup.get(key);
  assert.ok(row && row.proposition.includes(term), `missing context for truncated proposition ${key}`);
  assert.ok(row.source_review_required, `source review flag dropped for ${key}`);
}

// 2023: independent review + proposition segmentation regression cases.
// These tests verify the revised taxonomy data, not whether the answers are true.
const reviewed2023 = jsonl('propositions/2023.jsonl');
assert.equal(reviewed2023.length, 303, '2023 proposition count');
assert.equal(reviewed2023.filter((r) => r.classification_review?.version === 'taxonomy-v1.1').length, 303);
const check2023 = (q, choice, segment) => {
  const found = reviewed2023.filter((r) => r.question_number === q && r.choice_index === choice);
  assert.ok(found.length && found.every((r) => r.primary_path.join(' > ').includes(segment)), `2023-${q}/${choice}: ${segment}`);
};
for (const [q, choice, label] of [
  [3, 1, '社会保険一般'],
  [5, 3, '住所地特例'],
  [6, 4, '適用除外'],
  [14, 2, '地域ケア会議'],
  [22, 3, '施設サービス計画'],
  [31, 1, '認知症施策推進大綱'],
  [54, 1, '居宅介護住宅改修費'],
  [57, 3, '介護老人福祉施設（特養）'],
]) check2023(q, choice, label);
for (const [q, choice] of [[3, 5], [10, 4], [44, 3]]) {
  const matches = reviewed2023.filter((r) => r.question_number === q && r.choice_index === choice);
  assert.deepEqual(matches.map((r) => r.proposition_index), [1, 2]);
  assert.equal(matches[0].source_text, matches[1].source_text, 'preserve full original choice');
  assert.notEqual(matches[0].proposition, matches[1].proposition, 'split into distinct claims');
}
for (const q of [5, 6, 8, 13, 14, 15, 16, 29, 37]) {
  for (const row of reviewed2023.filter((r) => r.question_number === q)) {
    assert.notEqual(row.proposition, row.source_text, `context must be reconstructed: ${row.question_id}/${row.choice_index}`);
  }
}

for (const key of ['2024-22/5', '2024-32/5', '2024-35/3', '2024-40/2']) {
  const [qid, c] = key.split('/');
  const a = lookup.get(qid + '/' + c + '/1');
  const b = lookup.get(qid + '/' + c + '/2');
  assert.ok(a && b, 'missing split ' + key);
  assert.equal(a.source_text, b.source_text);
  assert.notEqual(a.proposition, b.proposition);
}
for (const n of [6, 7, 13, 17, 19, 39]) {
  const row = lookup.get('2024-' + String(n).padStart(2, '0') + '/1/1');
  assert.ok(row.proposition.length > row.source_text.length, 'predicate missing ' + n);
}
assert.equal(manifest.classification_review_2024.proposition_records, 304);

for (const f of ['review-decisions-2024-part1.json', 'review-decisions-2024-part2.json']) {
  assert.ok(json(f).groups.length > 0, `2024 audit record missing: ${f}`);
}

assert.ok(!checksumList.some((item) => item.path === 'checksums.json'), 'self-checksum is not stable');
for (const item of checksumList) {
  const buf = readFileSync(join(dir, item.path));
  const sum = createHash('sha256').update(buf).digest('hex');
  assert.equal(buf.byteLength, item.bytes, `size mismatch: ${item.path}`);
  assert.equal(sum, item.sha256, `checksum mismatch: ${item.path}`);
}
assert.ok(checksumList.some((item) => item.path === 'README.md'), 'README checksum missing');
for (let year = 2005; year <= 2025; year++) {
  assert.ok(checksumList.some((item) => item.path === `propositions/${year}.jsonl`), 'annual checksum missing: ' + year);
}
assert.match(read('README.md'), /初回分類時点のスナップショット/);
console.log(`taxonomy experiment integrity OK: ${total} propositions; ${difficult.length} difficult; ${Object.values(reviewed).reduce((a, b) => a + b, 0)} reviewed; ${checksumList.length} checksums`);
