#!/usr/bin/env node
/** Sync corrected repository text after consolidating revisions. Rebuild summaries afterwards. */
import assert from 'node:assert/strict';
import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { dataDir, loadYear, validateYearRows } from './issue32-revisions.mjs';
import { assertSourceRows, loadSourceYear, sourceSyncSummary } from './issue32-sources.mjs';

const checking = process.argv.includes('--check');
assert.ok(process.argv.slice(2).every((arg) => arg === '--check'), 'usage: sync-issue32-sources.mjs [--check]');
const revisions = join(dataDir, 'revisions');
assert.ok(!existsSync(revisions) || readdirSync(revisions, { recursive: true }).every((name) => !name.endsWith('.jsonl')),
  'Consolidate question revisions before syncing source text');

function updatedProposition(row, text) {
  if (row.proposition === row.source_text) return text;
  // Curated context and independent splits must survive text synchronization.
  // These six 2024 questions embed a short choice in a reviewed predicate.
  if (row.year === 2024 && [6, 7, 13, 17, 19, 39].includes(row.question_number)) {
    const suffix = {
      6: 'には区分支給限度基準額が適用される。',
      7: 'は市町村長が指定する事業者によって提供されるサービスである。',
      13: 'は認知症総合支援事業で配置の対象となる。',
      17: 'は要介護認定の認定調査票（基本調査）の項目に含まれる。',
      19: 'は要介護認定の主治医意見書の項目に含まれる。',
      39: 'の資格を持つ者は死亡診断書を交付できる。',
    }[row.question_number];
    return '「' + text + '」' + suffix;
  }
  if (row.source_text === text) return row.proposition;
  if (row.proposition.includes(row.source_text)) return row.proposition.replace(row.source_text, text);
  // Already curated before PR39: four 2024 splits and the 2009 rubi removal.
  const key = row.question_id + '/' + row.choice_index;
  const reviewed = new Set(['2024-22/5', '2024-32/5', '2024-35/3', '2024-40/2', '2009-28/2']);
  assert.ok(reviewed.has(key), 'Source changed in a curated proposition; review explicitly: ' + key);
  return row.proposition;
}

const all = [];
let changes = 0;
for (let year = 2005; year <= 2025; year++) {
  const source = loadSourceYear(year);
  const rows = loadYear(year, { baselineOnly: true });
  // PR39 also resolves this previously unreadable option label in the classification metadata.
  for (const row of rows) if (year === 2024 && row.question_number === 39 && row.choice_index === 5) {
    const oldLabel = '「草人」（原文OCR要確認）';
    const text = source.questions.get(39).choices[4];
    if (checking) {
      assert.ok(![row.attribute, row.classification_reason, ...row.primary_path].some((value) => value.includes(oldLabel)),
        '2024-39/5: corrected source label is out of sync');
    } else if (row.attribute === oldLabel) {
      row.source_label_revisions ??= [];
      row.source_label_revisions.push({
        source_path: source.source_path,
        previous: { attribute: row.attribute, primary_path: row.primary_path, classification_reason: row.classification_reason },
        reason: 'PR39の校正で判明した選択肢名を反映。知識の主語・正誤・法令は変更しない。',
      });
      row.attribute = text;
      row.primary_path = row.primary_path.map((label) => label === oldLabel ? text : label);
      row.classification_reason = row.classification_reason.replaceAll(oldLabel, text);
      changes++;
    }
  }
  if (checking) assertSourceRows(year, rows, source);
  else for (const row of rows) {
    const question = source.questions.get(row.question_number);
    assert.equal(row.question_id, question.id, 'Source identity changed');
    const text = question.choices[row.choice_index - 1];
    const proposition = updatedProposition(row, text);
    if (row.question_stem === question.stem && row.source_text === text && row.proposition === proposition) continue;
    row.source_text_revisions ??= [];
    row.source_text_revisions.push({
      source_path: source.source_path,
      reference: 'docs/ocr-text-corrections-2026-10-11.md',
      previous: { question_stem: row.question_stem, source_text: row.source_text, proposition: row.proposition },
      scope: 'Text sync only; classification histories, scoring and law/source review flags retained.',
    });
    row.question_stem = question.stem;
    row.source_text = text;
    row.proposition = proposition;
    if (question.text_status) row.source_text_status = question.text_status;
    row.source_text_sync = {
      source_path: source.source_path,
      secondary_text_source: question.secondary_text_source ?? null,
      text_status: question.text_status ?? null,
      official_double_proofread_complete: false,
    };
    changes++;
  }
  validateYearRows(year, rows);
  all.push({ year, rows });
}
// Validate all years before writing any of them.
if (!checking) for (const { year, rows } of all) {
  writeFileSync(join(dataDir, 'propositions', year + '.jsonl'), rows.map((row) => JSON.stringify(row)).join('\n') + '\n');
}
const { inputs, ...summary } = sourceSyncSummary(all);
console.log((checking ? 'Source sync verified' : 'Source text synchronized') + ': ' + changes +
  ' changes; ' + JSON.stringify(summary));
