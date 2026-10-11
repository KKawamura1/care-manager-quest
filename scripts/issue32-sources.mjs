/** Repository text inputs for the Issue #32 experiment; no generated app packs. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliDecompressSync } from 'node:zlib';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
export function loadSourceYear(year) {
  let rows, inputs;
  if (year === 2025) {
    inputs = Array.from({ length: 5 }, (_, i) => 'imports/2025-all60/' + String(i + 1).padStart(2, '0') + '.b64');
    const encoded = inputs.map((path) => readFileSync(join(root, path), 'utf8')).join('');
    const bytes = brotliDecompressSync(Buffer.from(encoded, 'base64'));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),
      'badd92f316d751be0eb8414cfb4139f533e57a8186a0f53ab07302017de8161a', '2025 source projection changed');
    rows = JSON.parse(bytes.toString('utf8'));
  } else {
    const path = year <= 2017 ? 'src/data/packs/pre2018/' + year + '/questions.json'
      : year <= 2019 ? 'src/data/packs/' + year + '/questions.json' : 'imports/' + year + '/questions.json';
    inputs = [path];
    const parsed = JSON.parse(readFileSync(join(root, path), 'utf8'));
    rows = Array.isArray(parsed) ? parsed : parsed.questions;
  }
  assert.equal(rows.length, 60, year + ': source must have 60 questions');
  const questions = new Map();
  for (const row of rows) {
    const number = row.number ?? row.question_number;
    assert.ok(Number.isInteger(number) && number >= 1 && number <= 60 && !questions.has(number), year + ': invalid source number');
    assert.equal(row.year ?? row.exam_year ?? (year === 2025 ? Number(row.id.slice(0, 4)) : undefined), year,
      year + ': source year mismatch');
    assert.ok(row.stem && row.choices.length === 5 && row.choices.every((text) => typeof text === 'string' && text.trim()));
    questions.set(number, row);
  }
  return { questions, source_path: inputs[0], inputs: inputs.map((path) => {
    const bytes = readFileSync(join(root, path));
    return { path, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
  }) };
}

export function assertSourceRows(year, rows, source = loadSourceYear(year)) {
  for (const row of rows) {
    const question = source.questions.get(row.question_number);
    const key = row.question_id + '/' + row.choice_index + '/' + row.proposition_index;
    assert.equal(row.question_id, question.id, key + ': source ID differs');
    assert.equal(row.question_stem, question.stem, key + ': question stem is out of sync');
    assert.equal(row.source_text, question.choices[row.choice_index - 1], key + ': choice text is out of sync');
  }
}

export function sourceSyncSummary(all) {
  const questionKeys = new Set(), choiceKeys = new Set();
  let changedRecords = 0, changedPropositions = 0;
  for (const { rows } of all) for (const row of rows) {
    if (!row.source_text_revisions?.length) continue;
    changedRecords++;
    questionKeys.add(row.question_id);
    choiceKeys.add(row.question_id + '/' + row.choice_index);
    if (row.source_text_revisions.some((review) => review.previous.proposition !== row.proposition)) changedPropositions++;
  }
  return {
    method: 'repository_text_sync',
    checked_questions: 1260, checked_choices: 6300,
    changed_questions: questionKeys.size, changed_choices: choiceKeys.size,
    changed_records: changedRecords, changed_propositions: changedPropositions,
    inputs: all.flatMap(({ year }) => loadSourceYear(year).inputs),
    scope: 'PR39の校正文を含むリポジトリ入力と設問文・選択肢を同期。公式原文との二重校正・正誤・法令確認の完了を意味しない。',
  };
}
