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
const jsonl = (path) => read(path).trim().split('\n').map((line) => JSON.parse(line));
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
      assert.ok(row.subject_concept && row.attribute && row.classification_reason, key);
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
      assert.ok(row.classification_revision.previous_status);
      assert.ok(Array.isArray(row.classification_revision.previous_primary_path));
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
assert.equal(total, 6337);
assert.equal(manifest.coverage.proposition_record_count, total);
assert.equal(manifest.coverage.difficult_case_count, difficult.length);
assert.deepEqual(manifest.coverage.status_counts, statusTotal);
assert.deepEqual(manifest.coverage.primary_root_counts, rootTotal);
assert.deepEqual(reviewed, { 2018: 2, 2019: 300, 2020: 301, 2024: 105, 2025: 302 }, 'reviewed record counts');

const expectedPaths = [
  ['care_manager_2020_001/1/1', '要介護・要支援認定者数'],
  ['care_manager_2020_007/1/1', '高額介護サービス費'],
  ['care_manager_2020_020/3/1', '居宅介護支援'],
  ['care_manager_2020_025/5/1', 'ヤングケアラー'],
  ['care_manager_2020_034/1/1', '認知症初期集中支援チーム'],
  ['care_manager_2020_052/3/1', '居宅介護支援'],
  ['2018-10/5/1', '普通徴収と特別徴収'],
  ['2018-21/1/1', '認定調査票'],
  ['2019-04/1/1', '特定疾病'],
  ['2019-09/2/1', '第1号被保険者保険料'],
  ['2019-12/3/1', '包括的支援事業'],
  ['2019-21/1/1', '申請代行'],
  ['2019-24/4/1', '住環境の調整'],
  ['2019-48/2/1', '個別援助'],
  ['2019-54/3/1', '居宅介護住宅改修費'],
  ['2024-13/1/1', '認知症総合支援事業'],
  ['2024-31/1/1', '退院・退所支援'],
  ['2025-02/5/1', '認知症基本法'],
  ['2025-27/3/1', '膀胱留置カテーテル'],
  ['2025-44/1/1', '看護小規模多機能型居宅介護'],
  ['2025-51/1/1', '基本方針'],
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

assert.ok(!checksumList.some((item) => item.path === 'checksums.json'), 'self-checksum is not stable');
for (const item of checksumList) {
  const buf = readFileSync(join(dir, item.path));
  const sum = createHash('sha256').update(buf).digest('hex');
  assert.equal(buf.byteLength, item.bytes, `size mismatch: ${item.path}`);
  assert.equal(sum, item.sha256, `checksum mismatch: ${item.path}`);
}
assert.equal(checksumList.length, 25);
assert.match(read('README.md'), /初回分類時点のスナップショット/);
console.log(`taxonomy experiment integrity OK: ${total} propositions; ${difficult.length} difficult; 1010 reviewed; ${checksumList.length} checksums`);
