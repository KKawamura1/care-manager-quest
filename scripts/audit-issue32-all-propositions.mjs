#!/usr/bin/env node
/**
 * Census and non-destructive semantic-risk screen of ALL effective Issue #32 propositions.
 *
 * Every proposition gets an explicit audit row. A passing screen NEVER certifies that
 * the chosen knowledge drawer is semantically correct. Only independently inspected
 * knowledge_target_review decisions are counted as evidence of this round's review.
 *
 * Usage:
 *   node scripts/audit-issue32-all-propositions.mjs
 *   node scripts/audit-issue32-all-propositions.mjs --output-dir=/tmp/taxonomy-audit
 */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { dataDir, loadYear, validateYearRows } from './issue32-revisions.mjs';
import { readFileSync } from 'node:fs';

const nodeRegistry = JSON.parse(readFileSync(join(dataDir, 'taxonomy-v1.1.json'), 'utf8'));
const nodes = new Map(nodeRegistry.nodes.map((node) => [node.id, node]));
const criteria = [
  {
    id: 'condition_vs_legislation',
    rationale: '疾病ではなく給付・手帳・政策・機関等の知識かもしれない',
    applies: (root, p) => root === '1' && /(?:自立支援医療|障害福祉サービス|障害者手帳|介護保険法|高齢者虐待防止法|生活保護制度|介護報酬|加算を算定|認知症地域支援推進員|認知症初期集中支援チーム|地域包括支援センター|認知症ケアパス|医療保険から給付)/.test(p)
  },
  {
    id: 'technique_vs_provider_requirement',
    rationale: '一般技法ではなく特定サービスの運営基準・報酬・資格かもしれない',
    applies: (root, p) => root === '2' && /(?:指定.{0,24}(?:事業|施設|訪問|通所)|介護老人(?:保健|福祉|医療)|居宅介護支援事業者|介護予防支援事業者|施設サービス計画|介護報酬|加算).{0,120}(?:算定|加算|届け|義務|管理者|交付|記録|保存|指定|報酬|配置|計画を作成|しなければならない)/.test(p)
  },
  {
    id: 'technique_vs_clinical_fact',
    rationale: '支援技法ではなく疾病・症状・検査等の客観的知識かもしれない',
    applies: (root, p) => root === '2' && /(?:原因は|初期症状|合併症|検査値|発症リスク|症状の特徴|病態|罹患率|有病率|予後は)/.test(p)
  },
  {
    id: 'provider_vs_common_method',
    rationale: 'サービスが題材なだけで汎用アセスメント・意思決定支援かもしれない',
    applies: (root, p) => root === '3' && /(?:勧めた|助言した|提案した|本人の意思|自己決定|残存能力|理解できる言葉|できる部分|できない部分)/.test(p)
  },
  {
    id: 'provider_vs_system',
    rationale: '特定サービスではなく給付調整・行政制度の知識かもしれない',
    applies: (root, p) => root === '3' && /(?:高額医療|高額介護|保険料|住所地特例|生活保護の適用|給付調整|保険給付を優先|医療保険を優先|介護保険から給付|医療保険から給付)/.test(p)
  },
  {
    id: 'system_vs_provider',
    rationale: '公的制度一般ではなく事業者固有の人員・サービス提供基準かもしれない',
    applies: (root, p) => root === '4' && /(?:通所リハビリテーション|訪問介護|訪問看護|居宅介護支援|介護予防支援|介護老人保健施設|介護老人福祉施設).{0,90}(?:人員配置|サービス計画|従業者|管理者|設備基準|記録保存)/.test(p)
  },
];
const outputOption = process.argv.find((x) => x.startsWith('--output-dir='));
const outputDir = outputOption ? outputOption.slice('--output-dir='.length) : null;
const counts = {};
const years = [];
const audit = [];
let reviewedDecisions = 0, assigned = 0, ambiguous = 0, unmapped = 0;
let canonicalMissing = 0, canonicalUnknown = 0, nodeNotInPath = 0, labelAliases = 0, candidates = 0;
const keys = new Set();
const nowReviewVersion = 'judgment_knowledge_over_context';
for (let year = 2005; year <= 2025; year++) {
  const rows = loadYear(year);
  validateYearRows(year, rows);
  let yearCandidates = 0, yearReviewed = 0, yearAssigned = 0;
  for (const row of rows) {
    const key = [row.question_id, row.choice_index, row.proposition_index].join('/');
    assert.ok(!keys.has(key), 'duplicate ID: ' + key);
    keys.add(key);
    const flags = [];
    const root = row.primary_path?.[0] ?? null;
    const semanticallyReviewedHere = row.knowledge_target_review?.principle === nowReviewVersion;
    if (semanticallyReviewedHere) { reviewedDecisions++; yearReviewed++; }
    if (row.classification_status === 'assigned') {
      assigned++; yearAssigned++;
      const id = row.primary_node_id;
      if (!id) { flags.push('missing_canonical_id'); canonicalMissing++; }
      else if (!nodes.has(id)) { flags.push('unknown_canonical_id'); canonicalUnknown++; }
      else if (root !== id.split('.')[0]) {
        flags.push('canonical_root_inconsistent'); nodeNotInPath++;
      } else if (!row.primary_path.includes(nodes.get(id).label)) {
        // Legacy paths can use a more specific term or a synonym while an
        // existing canonical node ID remains correct. Do not flag a semantic error.
        labelAliases++;
      }
      for (const c of criteria) if (c.applies(root, row.proposition)) flags.push(c.id);
    } else if (row.classification_status === 'ambiguous') {
      ambiguous++; flags.push('unresolved_ambiguity');
    } else {
      unmapped++; flags.push('unmapped_or_source_review');
    }
    for (const f of flags) counts[f] = (counts[f] || 0) + 1;
    if (flags.some((f) => f !== 'missing_canonical_id')) { candidates++; yearCandidates++; }
    audit.push({
      key, year, question_stem: row.question_stem,
      proposition: row.proposition, status: row.classification_status,
      subject_concept: row.subject_concept, attribute: row.attribute,
      primary_node_id: row.primary_node_id ?? null, primary_path: row.primary_path,
      semantic_review_evidence: semanticallyReviewedHere ? 'judgment_knowledge_reviewed' : 'not_verified_by_this_audit',
      legacy_review_annotation_present: Boolean(row.classification_review || row.classification_revision),
      audit_flags: flags, audit_disposition: flags.some((f) => f !== 'missing_canonical_id') ?
        'triage_priority_unconfirmed' : 'screened_not_semantically_verified'
    });
  }
  years.push({ year, propositions: rows.length, assigned: yearAssigned,
    knowledge_target_reviewed: yearReviewed, semantic_risk_candidates: yearCandidates });
}
assert.equal(audit.length, 6346, 'unexpected proposition coverage');
assert.equal(years.length, 21);
assert.equal(keys.size, 6346);
assert.equal(assigned + ambiguous + unmapped, 6346);
assert.ok(reviewedDecisions >= 230, 'regression: expected at least 230 explicit decisions');
const summary = {
  scope: '2005–2025 annual baseline + all per-question revisions (effective data)',
  scope_proposition_count: audit.length, year_count: years.length,
  coverage_complete: true,
  review_limits: 'This is an exhaustive automated screen, NOT exhaustive human semantic validation. Unflagged is not certified correct.',
  judgment_knowledge_semantic_reviews: reviewedDecisions,
  other_not_semantically_verified_in_this_pass: audit.length - reviewedDecisions,
  classification_status: { assigned, ambiguous, other: unmapped },
  canonical_id: { missing: canonicalMissing, unknown: canonicalUnknown, root_inconsistent: nodeNotInPath, legacy_label_alias_or_detail: labelAliases },
  potential_semantic_misclassifications_by_heuristic: candidates,
  flag_counts: counts, yearly: years,
  audit_schema: 'Each proposition has one record. Flags are screening candidates, not proven errors.'
};
if (outputDir) {
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(join(outputDir, 'all-propositions-screening.jsonl'), audit.map((x) => JSON.stringify(x)).join('\n') + '\n');
  writeFileSync(join(outputDir, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
}
console.log('Issue32 full screen: ' + audit.length + '/' + audit.length + ' propositions across 21 years.');
console.log('Explicit judgment-knowledge decisions: ' + reviewedDecisions +
  '; remaining without THIS semantic verification: ' + (audit.length - reviewedDecisions) + '.');
console.log('Statuses: ' + assigned + ' assigned, ' + ambiguous + ' ambiguous, ' + unmapped + ' other.');
console.log('Canonical IDs missing: ' + canonicalMissing + '; legacy path label aliases: ' + labelAliases +
  '; risk candidates (excluding only missing ID): ' + candidates + '.');
console.log('Risk flags: ' + JSON.stringify(counts));
console.log('Per-year: ' + JSON.stringify(years));
