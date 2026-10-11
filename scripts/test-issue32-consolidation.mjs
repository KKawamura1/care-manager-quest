/** Regression checks for the previously undetected split-source and OCR sync failures. */
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const fixture = mkdtempSync(join(tmpdir(), 'issue32-consolidation-'));
const data = 'docs/taxonomy/issue-32-experiment';
function run(script, args = [], success = true, pattern) {
  const result = spawnSync(process.execPath, [join(fixture, 'scripts', script), ...args],
    { cwd: fixture, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  const output = result.stdout + result.stderr;
  assert.equal(result.status === 0, success, script + ': ' + output);
  if (pattern) assert.match(output, pattern);
}
function changeFile(path, mutate, check) {
  const absolute = join(fixture, path), original = readFileSync(absolute);
  try { writeFileSync(absolute, mutate(original.toString('utf8'))); check(); }
  finally { writeFileSync(absolute, original); }
}
function snapshot() {
  const directory = join(fixture, data);
  return readdirSync(directory, { recursive: true, withFileTypes: true }).filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name)).sort().map((path) =>
      [path.slice(directory.length), createHash('sha256').update(readFileSync(path)).digest('hex')]);
}
try {
  for (const path of ['scripts', data, 'imports', 'src/data/packs']) {
    mkdirSync(dirname(join(fixture, path)), { recursive: true });
    cpSync(join(root, path), join(fixture, path), { recursive: true });
  }
  run('consolidate-issue32-revisions.mjs', ['--check']);
  run('sync-issue32-sources.mjs', ['--check']);
  const before = snapshot();
  run('consolidate-issue32-revisions.mjs');
  run('sync-issue32-sources.mjs');
  run('consolidate-issue32-revisions.mjs');
  assert.deepEqual(snapshot(), before, 'repeated consolidation/source sync changed canonical data');

  // A later-year overlay, even if identical, cannot survive in a canonical-only dataset.
  const revision = join(fixture, data, 'revisions/2025/01.jsonl');
  mkdirSync(dirname(revision), { recursive: true });
  writeFileSync(revision, readFileSync(join(fixture, data, 'propositions/2025.jsonl'), 'utf8')
    .split('\n').filter(Boolean).map(JSON.parse).filter((row) => row.question_number === 1)
    .map(JSON.stringify).join('\n') + '\n');
  run('consolidate-issue32-revisions.mjs', ['--check'], false, /still has revisions: 2025/);
  run('sync-issue32-sources.mjs', ['--check'], false, /Consolidate question revisions/);
  rmSync(join(fixture, data, 'revisions'), { recursive: true });

  changeFile(data + '/manifest.json', (text) => {
    const manifest = JSON.parse(text); manifest.coverage.status_counts.assigned--; return JSON.stringify(manifest);
  }, () => run('consolidate-issue32-revisions.mjs', ['--check'], false, /manifest coverage differs/));
  changeFile(data + '/checksums.json', (text) => JSON.stringify(JSON.parse(text).filter((entry) => entry.path !== 'README.md')),
    () => run('consolidate-issue32-revisions.mjs', ['--check'], false, /checksum inventory differs/));
  changeFile(data + '/README.md', (text) => text.replace('判定知識の個別レビュー：', '判定知識の個別レビュー：誤集計'),
    () => run('consolidate-issue32-revisions.mjs', ['--check'], false, /README summary or annual table differs/));
  changeFile('imports/2024/questions.json', (text) => {
    const source = JSON.parse(text); source.questions.find((q) => q.number === 10).stem = '8つ選べ'; return JSON.stringify(source);
  }, () => {
    run('sync-issue32-sources.mjs', ['--check'], false, /2024-10\/1\/1: question stem is out of sync/);
    run('consolidate-issue32-revisions.mjs', ['--check'], false, /source synchronization metadata differs/);
  });

  // A split retains two independently worded claims; OCR corrections reach contextual propositions.
  const rows2024 = readFileSync(join(fixture, data, 'propositions/2024.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
  const drug = rows2024.find((row) => row.question_number === 39 && row.choice_index === 5);
  assert.equal(drug.source_text, '薬剤師');
  assert.equal(drug.proposition, '「薬剤師」の資格を持つ者は死亡診断書を交付できる。');
  assert.ok(drug.source_review_required);
  assert.match(drug.source_text_revisions[0].previous.source_text, /草人/);
  for (const [question, choice] of [[22, 5], [32, 5], [35, 3], [40, 2]]) {
    const split = rows2024.filter((row) => row.question_number === question && row.choice_index === choice);
    assert.equal(split.length, 2); assert.equal(split[0].source_text, split[1].source_text);
    assert.notEqual(split[0].proposition, split[1].proposition);
  }
  run('consolidate-issue32-revisions.mjs', ['--check']);
  run('sync-issue32-sources.mjs', ['--check']);
  console.log('Consolidation/source regressions OK: idempotence, later-year overlays, counts, README, checksum inventory, OCR drift and split preservation.');
} finally { rmSync(fixture, { recursive: true, force: true }); }
