#!/usr/bin/env node
/**
 * Scaffold one independently reviewable question file without modifying shared reports.
 * Usage: node scripts/create-issue32-revision.mjs 2005 01
 */
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { FIRST_YEAR, LAST_YEAR, loadYear, revisionPath } from './issue32-revisions.mjs';

const [yearText, questionText] = process.argv.slice(2);
const year = Number(yearText);
const number = Number(questionText);
if (!/^\d{4}$/.test(yearText || '') || year < FIRST_YEAR || year > LAST_YEAR ||
    !/^\d{1,2}$/.test(questionText || '') || number < 1 || number > 60) {
  console.error('Usage: node scripts/create-issue32-revision.mjs YEAR QUESTION (e.g. 2005 01)');
  process.exitCode = 1;
} else {
  const dest = revisionPath(year, number);
  assert.ok(!existsSync(dest), 'revision already exists; edit it directly: ' + dest);
  const rows = loadYear(year).filter((r) => r.question_number === number);
  assert.ok(rows.length >= 5, 'question not found: ' + year + '/' + number);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, rows.map((r) => JSON.stringify(r)).join('\n') + '\n', { encoding: 'utf8', flag: 'wx' });
  console.log('Created ' + dest);
  console.log('Only commit this question file; do not update the baseline manifest, checksum, or difficult-case list.');
}
