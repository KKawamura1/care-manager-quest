#!/usr/bin/env node
/**
 * Validate effective taxonomy records after per-question revisions.
 * Use --json for computed current coverage, --difficult for the current review queue.
 * No tracked summaries are rewritten: parallel question edits must never conflict on them.
 */
import { collectSummary } from './issue32-revisions.mjs';
const { summary, difficultCases } = collectSummary();
if (process.argv.includes('--json')) {
  process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
} else if (process.argv.includes('--difficult')) {
  process.stdout.write(difficultCases.map((r) => JSON.stringify(r)).join('\n') + (difficultCases.length ? '\n' : ''));
} else {
  console.log('Effective taxonomy OK: ' + summary.question_count + ' questions, ' +
    summary.choice_count + ' choices, ' + summary.proposition_record_count + ' propositions, ' +
    summary.difficult_case_count + ' difficult cases.');
}
